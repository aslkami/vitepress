---
map:
  path: vue/source
---

## Vue2 异步更新

- watcher 里面的 update 方法

```js
update(){
    queueWatcher(this);
}
```

- scheduler

```js
import { nextTick } from '../util/next-tick';
let has = {};
let queue = [];

function flushSchedulerQueue() {
  for (let i = 0; i < queue.length; i++) {
    let watcher = queue[i];
    watcher.run();
  }
  queue = [];
  has = {};
}

let pending = false;
export function queueWatcher(watcher) {
  const id = watcher.id;
  if (has[id] == null) {
    has[id] = true;
    queue.push(watcher);
    if (!pending) {
      nextTick(flushSchedulerQueue);
      pending = true;
    }
  }
}
```

- util/next-tick.js

```js
let callbacks = [];
function flushCallbacks() {
  callbacks.forEach((cb) => cb());
}
let timerFunc;
if (Promise) {
  // then方法是异步的
  timerFunc = () => {
    Promise.resolve().then(flushCallbacks);
  };
} else if (MutationObserver) {
  // MutationObserver 也是一个异步方法
  let observe = new MutationObserver(flushCallbacks); // H5的api
  let textNode = document.createTextNode(1);
  observe.observe(textNode, {
    characterData: true,
  });
  timerFunc = () => {
    textNode.textContent = 2;
  };
} else if (setImmediate) {
  timerFunc = () => {
    setImmediate(flushCallbacks);
  };
} else {
  timerFunc = () => {
    setTimeout(flushCallbacks, 0);
  };
}
export function nextTick(cb) {
  callbacks.push(cb);
  timerFunc();
}
```

- 总结

1. 先明确 每个组件一个 `watcher` 对应一个 `id`
2. 每次改变数据的时候，都会走 `set` 方法, 然后走 `dep 的 notify` 方法，从而调用 `watcher 的 update` 方法
3. `update` 里调用 `queueWatcher` 方法, 因为一个方法里可以修改多个属性，它们对应的是同一个 `watcher`，所以要对其去重处理，最终一个 组件只会重新渲染一次
4. 最后把去重后的任务队列，放在微任务队列里去执行更新

## Vue3 异步更新

### watchAPI

- 同步 watch

```js
const state = reactive({ name: 'fate' });
watch(
  () => state.name,
  (newValue, oldValue) => {
    console.log(newValue, oldValue);
  },
  { flush: 'sync' },
); // 同步watcher
setTimeout(() => {
  state.name = 'night';
  state.name = 'fate';
}, 1000);
```

> watchAPI 根据传入的参数不同，有不同的调用方式

```js
export function watch(source, cb, options: any = {}) {
  dowatch(source, cb, options);
}
function dowatch(source, cb, { flush, immediate }) {
  let getter = () => source.call(currentInstance); // 保证函数中的this 是当前实例
  let oldValue;
  const job = () => {
    if (cb) {
      const newValue = runner(); // 获取新值
      if (hasChanged(newValue, oldValue)) {
        // 如果有变化，调用对应的callback
        cb(newValue, oldValue);
        oldValue = newValue; // 更新值
      }
    }
  };
  let scheduler;
  if (flush == 'sync') {
    scheduler = job;
  } else if (flush === 'post') {
  } else {
    // flush === 'pre'
  }
  const runner = effect(getter, {
    lazy: true,
    scheduler,
  });
  if (cb) {
    if (immediate) {
      job(); // 立即让cb执行
    } else {
      oldValue = runner(); // 仅执行不调用 cb
    }
  }
}
```

- 异步 watch

> 多次进行更改操作，最终仅仅执行一次

```js
const state = reactive({ name: 'fate' });
watch(
  () => state.name,
  (newValue, oldValue) => {
    console.log(newValue, oldValue); // xxx fate
  },
);
setTimeout(() => {
  state.name = 'stay';
  state.name = 'xxx';
}, 1000);
```

> 根据参数不同，将任务放到不同的队列中

```js
let pendingPreFlushCbs = []; // preCallback
let pendingPostFlushCbs = []; // postCallback

export function queuePreFlushCb(cb) {
  queueCb(cb, pendingPreFlushCbs);
}
export function queuePostFlushCb(cb) {
  queueCb(cb, pendingPostFlushCbs);
}

function queueCb(cb, pendingQueue) {
  pendingQueue.push(cb);
  queueFlush();
}
let isFlushPending = false;
function queueFlush() {
  if (!isFlushPending) {
    //保证queueFlush方法只能调用一次
    isFlushPending = true;
    Promise.resolve().then(flushJobs);
  }
}
function flushJobs() {
  isFlushPending = false;
  flushPreFlushCbs(); // 刷新队列
  flushPostFlushCbs();
}
function flushPreFlushCbs() {
  if (pendingPreFlushCbs.length) {
    const deduped: any = [...new Set(pendingPreFlushCbs)];
    pendingPreFlushCbs.length = 0;
    console.log(deduped);
    for (let i = 0; i < deduped.length; i++) {
      deduped[i]();
    }
    flushPreFlushCbs(); // 递归直到用尽
  }
}
function flushPostFlushCbs() {
  if (pendingPostFlushCbs.length) {
    const deduped: any = [...new Set(pendingPostFlushCbs)];
    pendingPostFlushCbs.length = 0;
    for (let i = 0; i < deduped.length; i++) {
      deduped[i]();
    }
  }
}
```

### watchEffect

> watchEffect 是没有 cb 的 watch，当数据变化后会重新执行 source 函数

```js
const state = reactive({ name: 'fate' });
watchEffect(() => console.log(state.name));
state.name = 'stay';
```

> watchEffect 实现

```js
export function watchEffect(source, options) {
  dowatch(source, null, options);
}
```

```js
function dowatch(source, cb, { flush, immediate }) {
  const job = () => {
    if (cb) {
      // ....
    } else {
      // watchEffect 不需要新旧对比
      runner();
    }
  };
  if (cb) {
    // ...
  } else {
    // watchEffect 默认会执行一次
    runner();
  }
}
```

### 组件异步更新原理

scheduler.js

```js
const queue = [];
let isFlushing = false;
const resolvedPromise = Promise.resolve();
export function queueJob(job) {
  if (!queue.includes(job)) {
    queue.push(job);
  }
  if (!isFlushing) {
    isFlushing = true;
    resolvedPromise.then(() => {
      isFlushing = false;
      for (let i = 0; i < queue.length; i++) {
        let job = queue[i];
        job();
      }
      queue.length = 0;
    });
  }
}
```

也是收集起来，一起放到微任务队列执行
