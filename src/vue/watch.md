---
map:
  path: vue/source
---

## Vue2 Watch 原理

```js
let vm = new Vue({
  el: '#app',
  data() {
    return { name: 'zf' };
  },
  watch: {
    name(newValue, oldValue) {
      console.log(newValue, oldValue);
    },
  },
});
```

> watch 用于监控用户的 data 变化，数据变化后会触发对应的 watch 的回调方法

```js
if (opts.watch) {
  initWatch(vm, opts.watch);
}
```

> 初始化时调用 `initWatch`

选项中如果有 watch 则对 watch 进行初始化

```js
function initWatch(vm, watch) {
  for (const key in watch) {
    const handler = watch[key];
    // 如果结果值是数组循环创建watcher
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i]);
      }
    } else {
      createWatcher(vm, key, handler);
    }
  }
}
function createWatcher(vm, exprOrFn, handler, options) {
  // 如果是对象则提取函数 和配置
  if (isObject(handler)) {
    options = handler;
    handler = handler.handler;
  }
  // 如果是字符串就是实例上的函数
  if (typeof handler == 'string') {
    handler = vm[handler];
  }
  return vm.$watch(exprOrFn, handler, options);
}
```

> 这里涉及了 watch 的三种写法,1.值是对象、2.值是数组、3.值是字符串 （如果是对象可以传入一些 watch 参数），最终会调用 vm.$watch 来实现

扩展 Vue 原型上的方法，都通过 mixin 的方式来进行添加的。

```js
stateMixin(Vue);
export function stateMixin(Vue) {
  Vue.prototype.$watch = function (exprOrFn, cb, options = {}) {
    options.user = true; // 标记为用户watcher
    // 核心就是创建个watcher
    const watcher = new Watcher(this, exprOrFn, cb, options);
    if (options.immediate) {
      cb.call(vm, watcher.value);
    }
  };
}
```

```js
class Watcher {
  constructor(vm, exprOrFn, callback, options) {
    // ...
    this.user = !!options.user;
    if (typeof exprOrFn === 'function') {
      this.getter = exprOrFn;
    } else {
      this.getter = function () {
        // 将表达式转换成函数
        let path = exprOrFn.split('.');
        let obj = vm;
        for (let i = 0; i < path.length; i++) {
          obj = obj[path[i]];
        }
        return obj;
      };
    }
    this.value = this.get(); // 将初始值记录到value属性上
  }
  get() {
    pushTarget(this); // 把用户定义的watcher存起来
    const value = this.getter.call(this.vm); // 执行函数 （依赖收集）
    popTarget(); // 移除watcher
    return value;
  }
  run() {
    let value = this.get(); // 获取新值
    let oldValue = this.value; // 获取老值
    this.value = value;
    if (this.user) {
      // 如果是用户watcher 则调用用户传入的callback
      this.callback.call(this.vm, value, oldValue);
    }
  }
}
```

> 还是借助 vue 响应式原理，默认在取值时将 watcher 存放到对应属性的 dep 中，当数据发生变化时通知对应的 watcher 重新执行

## Vue3 Watch 原理

watch 的核心就是观测一个响应式数据，当数据变化时通知并执行回调 （那也就是说它本身就是一个 effect）

```js
watch(state, (oldValue, newValue) => {
  // 监测一个响应式值的变化
  console.log(oldValue, newValue);
});
```

### 监听响应式对象

```js
function traverse(value, seen = new Set()) {
  if (!isObject(value)) {
    return value;
  }
  if (seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const k in value) {
    // 递归访问属性用于依赖收集
    traverse(value[k], seen);
  }
  return value;
}
export function isReactive(value) {
  return !!(value && value[ReactiveFlags.IS_REACTIVE]);
}
export function watch(source, cb) {
  let getter;
  if (isReactive(source)) {
    // 如果是响应式对象
    getter = () => traverse(source); // 包装成effect对应的fn, 函数内部进行遍历达到依赖收集的目的
  }
  let oldValue;
  const job = () => {
    const newValue = effect.run(); // 值变化时再次运行effect函数,获取新值
    cb(newValue, oldValue);
    oldValue = newValue;
  };
  const effect = new ReactiveEffect(getter, job); // 创建effect
  oldValue = effect.run(); // 运行保存老值
}
```

### 监测函数

```js
export function watch(source, cb) {
  let getter;
  if (isReactive(source)) {
    // 如果是响应式对象
    getter = () => traverse(source);
  } else if (isFunction(source)) {
    getter = source; // 如果是函数则让函数作为fn即可
  }
  // ...
}
```

### watch 中回调执行时机

```js
export function watch(source,cb,{immediate} = {} as any){
	const effect = new ReactiveEffect(getter,job) // 创建effect
    if(immediate){ // 需要立即执行，则立刻执行任务
        job();
    }
    oldValue = effect.run();
}
```

### watch 中 cleanup 实现

> 连续触发 watch 时需要清理之前的 watch 操作

```js
const state = reactive({ flag: true, name: 'jw', age: 30 });
let i = 2000;
function getData(timer) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(timer);
    }, timer);
  });
}
watch(
  () => state.age,
  async (newValue, oldValue, onCleanup) => {
    let clear = false;
    onCleanup(() => {
      clear = true;
    });
    i -= 1000;
    let r = await getData(i); // 第一次执行1s后渲染1000， 第二次执行0s后渲染0， 最终应该是0
    if (!clear) {
      document.body.innerHTML = r;
    }
  },
  { flush: 'sync' },
);
state.age = 31;
state.age = 32;
```

```js
let cleanup;
let onCleanup = (fn) => {
  cleanup = fn;
};
const job = () => {
  const newValue = effect.run();
  if (cleanup) cleanup(); // 下次watch执行前调用上次注册的回调
  cb(newValue, oldValue, onCleanup); // 传入onCleanup函数
  oldValue = newValue;
};
```

onCleanup 可以看作是是 watch 防抖，上述例子， `document.body.innerHtml` 只会执行一次

分析一下执行过程：

1. 首先要知道上面的 `getter` 函数返回的是监听的状态值，并且 `job`, 是 `effect` 的 `scheduler` , 状态值一更新，就会执行 `job` 函数
2. `state.age` 连续更改 2 次就会让 `job` 函数执行 2 次
3. 第一次执行的时候 `effect.run()` 就是 相当于初始 的 `getter` 函数获取最新值，`cleanup` 在第一次的时候暂时没有值，不会执行，然后就执行 `cb` 函数，进去，先执行同步代码，然后走异步代码， `变量i` 最终为 0, 然后开始执行异步代码
4. 第一次相当于 `setTimeout(1000)`, 第二次是 `setimeout(0)`, 而在第二次的时候 `cleanup` 才是有值的, 其值为上一次的引用，也就是说第一次 的 `clear` 被改为 true 了，自然无法执行 `document.body.innerHtml`，第二次才会执行。

相当于以下执行结果

```js
async function  A() {
    let clear = false

    clear = true    // 第二次 onCleanup 执行的结果，改变的是 第一次的 clear
    await Promise.resolve(() => {
        setTimeout(() => {
            // xxx
        }, 1000)
    })
    if(!clear) {
        document.body.innerHtml = 'xxxx'
    }
}

function  B() {
    let clear = false

    clear = false // onCleanup 不影响第二次的 clear
    await Promise.resolve(() => {
        setTimeout(() => {
            // xxx
        }, 0)
    })
    if(!clear) {
        document.body.innerHtml = 'xxxx'
    }
}
```

于是乎，先打印 b 的结果，因为是 0 s 执行的完
