## Pinia 初体验

> [官网](https://pinia.vuejs.org/) [翻译文档](https://pinia.web3doc.top/)

闲暇时玩了一下 `pinia`， 好奇取代 `vuex`, 是怎么样的，目前感觉不到什么，但是其 `composition api` 可以很完美的契合， 随着 `vue3` 的普及，逐渐取代 `vuex` 也不是不可能的，`vuex` 有的，`pinia` 都有。

## 区别

- pinia 没了 mutation 这一步骤
- pinia 可以有更好的 ts 体验
- pinia store 有多种定义的方式
- pinia 的 state 和 action 都可以直接修改 state

## 与 vuex 对比

- mutations 不再存在。他们经常被认为是 非常 冗长。他们最初带来了 devtools 集成，但这不再是问题。
- 无需创建自定义复杂包装器来支持 TypeScript，所有内容都是类型化的，并且 API 的设计方式尽可能利用 TS 类型推断。
- 不再需要注入、导入函数、调用函数、享受自动完成功能！
- 无需动态添加 Store，默认情况下它们都是动态的，您甚至都不会注意到。请注意，您仍然可以随时手动使用 Store 进行注册，但因为它是自动的，您无需担心。
- 不再有 modules 的嵌套结构。您仍然可以通过在另一个 Store 中导入和 使用 来隐式嵌套 Store，但 Pinia 通过设计提供平面结构，同时仍然支持 Store 之间的交叉组合方式。 您甚至可以拥有 Store 的循环依赖关系。
- 没有 命名空间模块。鉴于 Store 的扁平架构，“命名空间” Store 是其定义方式所固有的，您可以说所有 Store 都是命名空间的。

## 定义 store

```js
import { defineStore } from 'pinia';

export const useCounterStore = defineStore('counter', {
  state: () => {
    return { count: 0 };
  },
  // could also be defined as
  // state: () => ({ count: 0 })
  actions: {
    increment() {
      this.count++;
    },
  },
});

export const useCounterStore = defineStore('counter', () => {
  const count = ref(0);
  function increment() {
    count.value++;
  }

  return { count, increment };
});
```

定义 store 可以使用 option api 也可以使用 composition api

## 修改 state

```js
import { useCounterStore } from '@/stores/counter';

export default {
  setup() {
    const counter = useCounterStore();

    counter.count++;
    // with autocompletion ✨
    counter.$patch({ count: counter.count + 1 });
    // or using an action instead
    counter.increment();
  },
};
```

## getters

```js
export const useStore = defineStore('main', {
  state: () => ({
    counter: 0,
  }),
  getters: {
    // 自动将返回类型推断为数字
    doubleCount(state) {
      return state.counter * 2;
    },
    // 返回类型必须明确设置
    doublePlusOne(): number {
      return this.counter * 2 + 1;
    },
  },
});
```

## actions

action 和以前差不多 可以返回 一个 promise

```js
import { useAuthStore } from './auth-store';

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    // ...
  }),
  actions: {
    async fetchUserPreferences(preferences) {
      const auth = useAuthStore(); // 引用别的 store
      if (auth.isAuthenticated) {
        this.preferences = await fetchPreferences();
      } else {
        throw new Error('User must be authenticated');
      }
    },
  },
});
```
