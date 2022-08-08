---
map:
  path: vue/source
---

## Vue2 组件渲染原理

### 全局组件的解析

```html
<div id="app">
  <my-component></my-component>
  <my-component></my-component>
</div>
<script>
  Vue.component('my-component', {
    template: '<button>点我</button>',
  });
  let vm = new Vue({
    el: '#app',
  });
</script>
```

> 我们可以通过 Vue.component 注册全局组件，之后可以在模板中进行使用

```js
Vue.prototype._init = function (options) {
  const vm = this;
  vm.$options = mergeOptions(vm.constructor.options, options);
  // 初始化状态
  callHook(vm, 'beforeCreate');
  initState(vm);
  callHook(vm, 'created');
  if (vm.$options.el) {
    vm.$mount(vm.$options.el);
  }
};

export function initGlobalAPI(Vue) {
  // 整合了所有的全局相关的内容
  Vue.options = {};
  initMixin(Vue);

  // _base 就是Vue的构造函数
  Vue.options._base = Vue;
  Vue.options.components = {};

  initExtend(Vue);

  // 注册API方法
  initAssetRegisters(Vue);
}
```

- `Vue.component` 方法

```js
export default function initAssetRegisters(Vue) {
  Vue.component = function (id, definition) {
    definition.name = definition.name || id;
    definition = this.options._base.extend(definition);
    this.options['components'][id] = definition;
  };
}
```

> `Vue.component` 内部会调用 `Vue.extend` 方法，将定义挂载到 `Vue.options.components`上。这也说明所有的全局组件最终都会挂载到这个变量上

- `Vue.extend` 方法

```js
import { mergeOptions } from '../util/index';
export default function initExtend(Vue) {
  let cid = 0;
  Vue.extend = function (extendOptions) {
    const Super = this;
    const Sub = function VueComponent(options) {
      this._init(options);
    };
    Sub.cid = cid++;
    Sub.prototype = Object.create(Super.prototype);
    Sub.prototype.constructor = Sub;
    Sub.options = mergeOptions(Super.options, extendOptions);
    return Sub;
  };
}
```

> extend 方法就是创建出一个子类，继承于 Vue,并返回这个类

- 属性合并

```js
function mergeAssets(parentVal, childVal) {
  const res = Object.create(parentVal);
  if (childVal) {
    for (let key in childVal) {
      res[key] = childVal[key];
    }
  }
  return res;
}
strats.components = mergeAssets;
```

- 初始化合并

```js
vm.$options = mergeOptions(vm.constructor.options, options);
```

- mergeOptions

```js
export function mergeOptions(parent, child) {
  const options = {};
  for (let key in parent) {
    mergeField(key);
  }
  for (let key in child) {
    if (!parent.hasOwnProperty(key)) {
      mergeField(key);
    }
  }
  function mergeField(key) {
    if (strats[key]) {
      options[key] = strats[key](parent[key], child[key]);
    } else {
      if (typeof parent[key] == 'object' && typeof child[key] == 'object') {
        options[key] = {
          ...parent[key],
          ...child[key],
        };
      } else {
        options[key] = child[key];
      }
    }
  }
  return options;
}
```

### 组件的渲染

```js
function makeMap(str) {
  const map = {};
  const list = str.split(',');
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true;
  }
  return (key) => map[key];
}

export const isReservedTag = makeMap(
  'a,div,img,image,text,span,input,p,button',
);
```

> 在创建虚拟节点时我们要判断当前这个标签是否是组件，普通标签的虚拟节点和组件的虚拟节点有所不同

- 创建组件虚拟节点

```js
export function createElement(vm, tag, data = {}, ...children) {
  let key = data.key;
  if (key) {
    delete data.key;
  }
  if (typeof tag === 'string') {
    if (isReservedTag(tag)) {
      return vnode(tag, data, key, children, undefined);
    } else {
      // 如果是组件需要拿到组件的定义,通过组件的定义创造虚拟节点
      let Ctor = vm.$options.components[tag];
      return createComponent(vm, tag, data, key, children, Ctor);
    }
  }
}
function createComponent(vm, tag, data, key, children, Ctor) {
  // 获取父类构造函数t
  const baseCtor = vm.$options._base;
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor);
  }
  data.hook = {
    // 组件的生命周期钩子
    init() {},
  };
  return vnode(`vue-component-${Ctor.cid}-${tag}`, data, key, undefined, {
    Ctor,
    children,
  });
}
function vnode(tag, data, key, children, text, componentOptions) {
  return { tag, data, key, children, text, componentOptions };
}
```

- 创建组件的真实节点

```js
export function patch(oldVnode, vnode) {
  // 1.判断是更新还是要渲染
  if (!oldVnode) {
    return createElm(vnode);
  } else {
    // ...
  }
}
function createElm(vnode) {
  // 根据虚拟节点创建真实的节点
  let { tag, children, key, data, text } = vnode;
  // 是标签就创建标签
  if (typeof tag === 'string') {
    // createElm需要返回真实节点
    if (createComponent(vnode)) {
      return vnode.componentInstance.$el;
    }
    vnode.el = document.createElement(tag);
    updateProperties(vnode);
    children.forEach((child) => {
      // 递归创建儿子节点，将儿子节点扔到父节点中
      return vnode.el.appendChild(createElm(child));
    });
  } else {
    // 虚拟dom上映射着真实dom  方便后续更新操作
    vnode.el = document.createTextNode(text);
  }
  // 如果不是标签就是文本
  return vnode.el;
}
```

```js
function createComponent(vnode) {
  let i = vnode.data;
  if ((i = i.hook) && (i = i.init)) {
    i(vnode);
  }
  if (vnode.componentInstance) {
    return true;
  }
}
```

> 调用 init 方法,进行组件的初始化

```js
data.hook = {
  init(vnode) {
    let child = (vnode.componentInstance = new Ctor({}));
    child.$mount(); // 组件的挂载
  },
};
```

1. 组件渲染，主要是调用 `Vue.extend` 方法生成 子类继承 父类 的 原型方法和 静态方法
2. 递归解析模板之后，发现不是普通标签，则假定是自定义组件，就会去 `new Sub` 生成子类，然后重新走 mount 挂载流程

## Vue3 组件渲染

```js
const mountComponent = (n2, container, anchor) => {
  const { render, data = () => ({}) } = n2.type;
  const state = reactive(data());
  const instance = {
    state, // 组件的状态
    isMounted: false, // 组件是否挂载
    subTree: null, // 子树
    update: null,
    vnode: n2,
  };
  const componentUpdateFn = () => {
    if (!instance.isMounted) {
      const subTree = render.call(state, state);
      patch(null, subTree, container, anchor);
      instance.subTree = subTree;
      instance.isMounted = true;
    } else {
      const subTree = render.call(state, state);
      patch(instance.subTree, subTree, container, anchor);
      instance.subTree = subTree;
    }
  };
  const effect = new ReactiveEffect(componentUpdateFn);
  const update = (instance.update = effect.run.bind(effect));
  update();
};
const processComponent = (n1, n2, container, anchor) => {
  if (n1 == null) {
    mountComponent(n2, container, anchor);
  } else {
    // 组件更新逻辑
  }
};
```

主要看 `componentUpdateFn` 方法，组件挂在就是 new Effect，执行 `update` 方法，相当于执行了 `componentUpdateFn` 方法，从而调用 `render` 方法返回虚拟 dom，因为 render 里面的变量取值的时候会被 proxy 代理，所以数据一变化，组件便会重新执行 `effect` 渲染

### 组件异步渲染

修改调度方法，将更新方法压入到队列中

```js
const effect = new ReactiveEffect(componentUpdateFn, () =>
  queueJob(instance.update),
);
const update = (instance.update = effect.run.bind(effect));
```

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
