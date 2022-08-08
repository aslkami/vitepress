---
map:
  path: vue/source
---

## Vue2 Computed 原理

```js
if (opts.computed) {
  initComputed(vm, opts.computed);
}
```

```js
function initComputed(vm, computed) {
  // 存放计算属性的watcher
  const watchers = (vm._computedWatchers = {});
  for (const key in computed) {
    const userDef = computed[key];
    // 获取get方法
    const getter = typeof userDef === 'function' ? userDef : userDef.get;
    // 创建计算属性watcher
    watchers[key] = new Watcher(vm, userDef, () => {}, { lazy: true });
    defineComputed(vm, key, userDef);
  }
}
```

> 每个计算属性也都是一个 watcher,计算属性需要表示 lazy:true,这样在初始化 watcher 时不会立即调用计算属性方法

```js
class Watcher {
  constructor(vm, exprOrFn, callback, options) {
    this.vm = vm;
    this.dirty = this.lazy;
    // ...
    this.value = this.lazy ? undefined : this.get(); // 调用get方法 会让渲染watcher执行
  }
}
```

> 默认计算属性需要保存一个 dirty 属性，用来实现缓存功能

```js
function defineComputed(target, key, userDef) {
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = createComputedGetter(key);
  } else {
    sharedPropertyDefinition.get = createComputedGetter(userDef.get);
    sharedPropertyDefinition.set = userDef.set;
  }
  // 使用defineProperty定义
  Object.defineProperty(target, key, sharedPropertyDefinition);
}
```

创建缓存 getter

```js
function createComputedGetter(key) {
  return function computedGetter() {
    const watcher = this._computedWatchers[key];
    if (watcher) {
      if (watcher.dirty) {
        // 如果dirty为true
        watcher.evaluate(); // 计算出新值，并将dirty 更新为false
      }
      // 如果依赖的值不发生变化，则返回上次计算的结果
      return watcher.value;
    }
  };
}
```

watcher.evaluate

```js
evaluate() {
    this.value = this.get()
    this.dirty = false
}

update() {
    if (this.lazy) {
        this.dirty = true;
    } else {
        queueWatcher(this);
    }
}
```

> 当依赖的属性变化时，会通知 watcher 调用 update 方法，此时我们将 dirty 置换为 true。这样再取值时会重新进行计算。

```js
if (watcher) {
  if (watcher.dirty) {
    watcher.evaluate();
  }
  if (Dep.target) {
    // 计算属性在模板中使用 则存在Dep.target
    watcher.depend();
  }
  return watcher.value;
}
```

```js
depend() {
	let i = this.deps.length
	while (i--) {
		this.deps[i].depend()
	}
}
```

> 如果计算属性在模板中使用，就让计算属性中依赖的数据也记录渲染 watcher,这样依赖的属性发生变化也可以让视图进行刷新

## Vue3 Computed 原理

接受一个 getter 函数，并根据 getter 的返回值返回一个不可变的响应式 ref 对象。

```js
import { isFunction } from "@vue/shared";
import { activeEffect, ReactiveEffect, trackEffects, triggerEffects } from "./effect";

class ComputedRefImpl {
    public effect;
    public _value;
    public dep;
    public _dirty = true;
    constructor(getter,public setter) {
        this.effect = new ReactiveEffect(getter,()=>{
            if(!this._dirty){ // 依赖的值变化更新dirty并触发更新
                this._dirty = true;
                triggerEffects(this.dep)
            }
        });
    }
    get value(){ // 取值的时候进行依赖收集
        if(activeEffect){
            trackEffects(this.dep || (this.dep = new Set));
        }
        if(this._dirty){ // 如果是脏值, 执行函数
            this._dirty = false;
            this._value = this.effect.run();
        }
        return this._value;
    }
    set value(newValue){
        this.setter(newValue)
    }
}
export function computed(getterOrOptions) {
    const onlyGetter = isFunction(getterOrOptions); // 传入的是函数就是getter
    let getter;
    let setter;
    if (onlyGetter) {
        getter = getterOrOptions;
        setter = () => { }
    } else {
        getter = getterOrOptions.get;
        setter = getterOrOptions.set;
    }
    // 创建计算属性
    return new ComputedRefImpl(getter, setter)
}
```

> 创建 ReactiveEffect 时，传入 scheduler 函数，稍后依赖的属性变化时调用此方法！

```js
export function triggerEffects(effects) {
  effects = new Set(effects);
  for (const effect of effects) {
    if (effect !== activeEffect) {
      // 如果effect不是当前正在运行的effect
      if (effect.scheduler) {
        effect.scheduler();
      } else {
        effect.run(); // 重新执行一遍
      }
    }
  }
}
export function trackEffects(dep) {
  // 收集dep 对应的effect
  let shouldTrack = !dep.has(activeEffect);
  if (shouldTrack) {
    dep.add(activeEffect);
    activeEffect.deps.push(dep);
  }
}
```
