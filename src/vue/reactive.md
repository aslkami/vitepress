---
map:
  path: vue/source
---

## Vue2 响应式原理

### 初始化数据

```js
import { observe } from './observer/index.js';
function initData(vm) {
  let data = vm.$options.data;
  data = vm._data = typeof data === 'function' ? data.call(vm) : data;
  observe(data);
}
```

### 递归属性劫持

```js
class Observer {
  // 观测值
  constructor(value) {
    this.walk(value);
  }
  walk(data) {
    // 让对象上的所有属性依次进行观测
    let keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      let value = data[key];
      defineReactive(data, key, value);
    }
  }
}
function defineReactive(data, key, value) {
  observe(value);
  Object.defineProperty(data, key, {
    get() {
      return value;
    },
    set(newValue) {
      if (newValue == value) return;
      observe(newValue);
      value = newValue;
    },
  });
}
export function observe(data) {
  if (typeof data !== 'object' || data == null) {
    return;
  }
  return new Observer(data);
}
```

### 数组方法的劫持

```js
import { arrayMethods } from './array';
class Observer {
  // 观测值
  constructor(value) {
    if (Array.isArray(value)) {
      value.__proto__ = arrayMethods; // 重写数组原型方法
      this.observeArray(value);
    } else {
      this.walk(value);
    }
  }
  observeArray(value) {
    for (let i = 0; i < value.length; i++) {
      observe(value[i]);
    }
  }
}
```

### 重写数组原型方法

```js
let oldArrayProtoMethods = Array.prototype;
export let arrayMethods = Object.create(oldArrayProtoMethods);
let methods = ['push', 'pop', 'shift', 'unshift', 'reverse', 'sort', 'splice'];
methods.forEach((method) => {
  arrayMethods[method] = function (...args) {
    const result = oldArrayProtoMethods[method].apply(this, args);
    const ob = this.__ob__;
    let inserted;
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args;
        break;
      case 'splice':
        inserted = args.slice(2);
      default:
        break;
    }
    if (inserted) ob.observeArray(inserted); // 对新增的每一项进行观测
    return result;
  };
});
```

### 增加 `__ob__`

```js
class Observer {
  constructor(value) {
    Object.defineProperty(value, '__ob__', {
      enumerable: false,
      configurable: false,
      value: this,
    });
    // ...
  }
}
```

### 数据代理

```js
function proxy(vm, source, key) {
  Object.defineProperty(vm, key, {
    get() {
      return vm[source][key];
    },
    set(newValue) {
      vm[source][key] = newValue;
    },
  });
}
function initData(vm) {
  let data = vm.$options.data;
  data = vm._data = typeof data === 'function' ? data.call(vm) : data;
  for (let key in data) {
    // 将_data上的属性全部代理给vm实例
    proxy(vm, '_data', key);
  }
  observe(data);
}
```

1. `new Vue` 的执行过程会调用 `_init(options)` -> `initState()` -> `initData()` 获取数据
2. 通过对数据进行 `Object.defineProperty` 进行递归监测
3. 对数组进行了 `AOP 重写`，主要是监测数据的新增删除，使新增的数据也是响应式的
4. `__ob__` 属于 hack 写法, 使其在 数组重写的方法中 获得 `Observe` 的方法进行监测
5. 在 `defineProperty 的 set` 方法中，可以检测到数据变化，通过重新执行渲染方法，达到页面响应更新的效果

## Vue3 响应式原理

vue3 响应式原理主要靠 `reactive` 和 `effect` 这 2 个功能模块

- `reactive` 方法会将对象变成 `proxy` 对象
- `effect` 中使用 `reactive ` 对象时会进行依赖收集，稍后属性变化时会重新执行 `effect` 函数

### 编写 reactive 函数

```js
// 常用的就是reactive方法
export function reactive(target: object) {
  return createReactiveObject(target, false);
}
export function shallowReactive(target: object) {
  return createReactiveObject(target, false);
}
export function readonly(target: object) {
  return createReactiveObject(target, true);
}
export function shallowReadonly(target: object) {
  return createReactiveObject(target, true);
}
```

##### createReactiveObject

```js
const enum ReactiveFlags {
    IS_REACTIVE = '__v_isReactive'
}

const reactiveMap = new WeakMap(); // 缓存列表
const mutableHandlers: ProxyHandler<object> = {
    get(target, key, receiver) {
        if(key === ReactiveFlags.IS_REACTIVE){ // 在get中增加标识，当获取IS_REACTIVE时返回true
            return true;
        }
        // 等会谁来取值就做依赖收集
        const res = Reflect.get(target, key, receiver);
        return res;
    },
    set(target, key, value, receiver) {
        // 等会赋值的时候可以重新触发effect执行
        const result = Reflect.set(target, key, value, receiver);
        return result;
    }
}

function createReactiveObject(target: object, isReadonly: boolean) {
    // 处理 reactive(reactive({}))
    if(target[ReactiveFlags.IS_REACTIVE]){ // 在创建响应式对象时先进行取值，看是否已经是响应式对象
        return target
    }
    if (!isObject(target)) {
        return target
    }
    const exisitingProxy = reactiveMap.get(target); // 如果已经代理过则直接返回代理后的对象
    if (exisitingProxy) {
        return exisitingProxy;
    }
    const proxy = new Proxy(target, mutableHandlers); // 对对象进行代理
    reactiveMap.set(target,proxy)
    return proxy;
}
```

##### Proxy, Reflect

这里必须要使用 Reflect 进行操作，保证 this 指向永远指向代理对象

```js
let school = {
  name: 'zf',
  get num() {
    return this.name;
  },
};
let p = new Proxy(school, {
  get(target, key, receiver) {
    console.log(key);
    // return Reflect.get(target,key,receiver)
    return target[key];
  },
});
p.num;
```

### 编写 effect 函数

```js
export let activeEffect = undefined;// 当前正在执行的effect

class ReactiveEffect {
    active = true;
    deps = []; // 收集effect中使用到的属性
    parent = undefined;
    constructor(public fn) { }
    run() {
        if (!this.active) { // 不是激活状态
            return this.fn();
        }
        try {
            this.parent = activeEffect; // 当前的effect就是他的父亲
            activeEffect = this; // 设置成正在激活的是当前effect
            return this.fn();
        } finally {
            activeEffect = this.parent; // 执行完毕后还原activeEffect
            this.parent = undefined;
        }

    }
}
export function effect(fn, options?) {
    const _effect = new ReactiveEffect(fn); // 创建响应式effect
    _effect.run(); // 让响应式effect默认执行
}
```

### 依赖收集

默认执行 effect 时会对属性，进行依赖收集

```js
get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
        return true;
    }
    const res = Reflect.get(target, key, receiver);
    track(target, 'get', key);  // 依赖收集
    return res;
}
```

```js
const targetMap = new WeakMap(); // 记录依赖关系
export function track(target, type, key) {
  if (activeEffect) {
    let depsMap = targetMap.get(target); // {对象：map}
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()));
    }
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, (dep = new Set())); // {对象：{ 属性 :[ dep, dep ]}}
    }
    let shouldTrack = !dep.has(activeEffect);
    if (shouldTrack) {
      dep.add(activeEffect);
      activeEffect.deps.push(dep); // 让effect记住dep，这样后续可以用于清理
    }
  }
}
```

将属性和对应的 effect 维护成映射关系，后续属性变化可以触发对应的 effect 函数重新 run

### 触发更新

```js
set(target, key, value, receiver) {
    // 等会赋值的时候可以重新触发effect执行
    let oldValue = target[key]
    const result = Reflect.set(target, key, value, receiver);
    if (oldValue !== value) {
        trigger(target, 'set', key, value, oldValue)
    }
    return result;
}
```

```js
export function trigger(target, type, key?, newValue?, oldValue?) {
  const depsMap = targetMap.get(target); // 获取对应的映射表
  if (!depsMap) {
    return;
  }
  const effects = depsMap.get(key);
  effects &&
    effects.forEach((effect) => {
      if (effect !== activeEffect) effect.run(); // 防止循环
    });
}
```

### 分支切换与 cleanup

在渲染时我们要避免副作用函数产生的遗留

```js
const state = reactive({ flag: true, name: 'jw', age: 30 });
effect(() => {
  // 副作用函数 (effect执行渲染了页面)
  console.log('render');
  document.body.innerHTML = state.flag ? state.name : state.age;
});
setTimeout(() => {
  state.flag = false;
  setTimeout(() => {
    console.log('修改name，原则上不更新');
    state.name = 'zf';
  }, 1000);
}, 1000);
```

```js
function cleanupEffect(effect) {
    const { deps } = effect; // 清理effect
    for (let i = 0; i < deps.length; i++) {
        deps[i].delete(effect);
    }
    effect.deps.length = 0;
}

class ReactiveEffect {
    active = true;
    deps = []; // 收集effect中使用到的属性
    parent = undefined;
    constructor(public fn) { }
    run() {
        try {
            this.parent = activeEffect; // 当前的effect就是他的父亲
            activeEffect = this; // 设置成正在激活的是当前effect
+           cleanupEffect(this);
            return this.fn(); // 先清理在运行
        }
    }
}
```

> 这里要注意的是：触发时会进行清理操作（清理 effect），在重新进行收集（收集 effect）。在循环过程中会导致死循环。

```js
let effect = () => {};
let s = new Set([effect]);
s.forEach((item) => {
  s.delete(effect);
  s.add(effect);
}); // 这样就导致死循环了
```

### 停止 effect

```js
export class ReactiveEffect {
  stop() {
    if (this.active) {
      cleanupEffect(this);
      this.active = false;
    }
  }
}
export function effect(fn, options?) {
  const _effect = new ReactiveEffect(fn);
  _effect.run();

  const runner = _effect.run.bind(_effect);
  runner.effect = _effect;
  return runner; // 返回runner
}
```

### 调度执行

`trigger` 触发时，我们可以自己决定副作用函数执行的时机、次数、及执行方式

```js
export function effect(fn, options: any = {}) {
  const _effect = new ReactiveEffect(fn, options.scheduler); // 创建响应式effect
  // if(options){
  //     Object.assign(_effect,options); // 扩展属性
  // }
  _effect.run(); // 让响应式effect默认执行
  const runner = _effect.run.bind(_effect);
  runner.effect = _effect;
  return runner; // 返回runner
}

export function trigger(target, type, key?, newValue?, oldValue?) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }
  let effects = depsMap.get(key);
  if (effects) {
    effects = new Set(effects);
    for (const effect of effects) {
      if (effect !== activeEffect) {
        if (effect.scheduler) {
          // 如果有调度函数则执行调度函数
          effect.scheduler();
        } else {
          effect.run();
        }
      }
    }
  }
}
```

### 深度代理

```js
 get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
        return true;
    }
    // 等会谁来取值就做依赖收集
    const res = Reflect.get(target, key, receiver);
    track(target, 'get', key);

    if(isObject(res)){
        return reactive(res);
    }
    return res;
}
```
