---
map:
  path: vue/source
---

## Vue Dom Diff

### 比对标签

- 在 diff 过程中会先比较标签是否一致，如果标签不一致用新的标签替换掉老的标签
- 如果标签一致，有可能都是文本节点，那就比较文本的内容即可

### 比对属性

```js
// 复用标签,并且更新属性
let el = (vnode.el = oldVnode.el);
updateProperties(vnode, oldVnode.data);
function updateProperties(vnode, oldProps = {}) {
  let newProps = vnode.data || {};
  let el = vnode.el;
  // 比对样式
  let newStyle = newProps.style || {};
  let oldStyle = oldProps.style || {};
  for (let key in oldStyle) {
    if (!newStyle[key]) {
      el.style[key] = '';
    }
  }
  // 删除多余属性
  for (let key in oldProps) {
    if (!newProps[key]) {
      el.removeAttribute(key);
    }
  }
  for (let key in newProps) {
    if (key === 'style') {
      for (let styleName in newProps.style) {
        el.style[styleName] = newProps.style[styleName];
      }
    } else if (key === 'class') {
      el.className = newProps.class;
    } else {
      el.setAttribute(key, newProps[key]);
    }
  }
}
```

> 当标签相同时，我们可以复用老的标签元素，并且进行属性的比对

### 比对子元素

```js
// 比较孩子节点
let oldChildren = oldVnode.children || [];
let newChildren = vnode.children || [];
// 新老都有需要比对儿子
if (oldChildren.length > 0 && newChildren.length > 0) {
  // 老的有儿子新的没有清空即可
} else if (oldChildren.length > 0) {
  el.innerHTML = '';
  // 新的有儿子
} else if (newChildren.length > 0) {
  for (let i = 0; i < newChildren.length; i++) {
    let child = newChildren[i];
    el.appendChild(createElm(child));
  }
}
```

> 这里要判断新老节点儿子的状况

```js
if (oldChildren.length > 0 && newChildren.length > 0) {
  updateChildren(el, oldChildren, newChildren);
  // 老的有儿子新的没有清空即可
}
```

## Vue2 Diff 中的优化策略

### 在开头和结尾新增元素

```js
function isSameVnode(oldVnode, newVnode) {
  // 如果两个人的标签和key 一样我认为是同一个节点 虚拟节点一样我就可以复用真实节点了
  return oldVnode.tag === newVnode.tag && oldVnode.key === newVnode.key;
}
function updateChildren(parent, oldChildren, newChildren) {
  let oldStartIndex = 0;
  let oldStartVnode = oldChildren[0];
  let oldEndIndex = oldChildren.length - 1;
  let oldEndVnode = oldChildren[oldEndIndex];

  let newStartIndex = 0;
  let newStartVnode = newChildren[0];
  let newEndIndex = newChildren.length - 1;
  let newEndVnode = newChildren[newEndIndex];

  while (oldStartIndex <= oldEndIndex && newStartIndex <= newEndIndex) {
    // 优化向后追加逻辑
    if (isSameVnode(oldStartVnode, newStartVnode)) {
      patch(oldStartVnode, newStartVnode);
      oldStartVnode = oldChildren[++oldStartIndex];
      newStartVnode = newChildren[++newStartIndex];
      // 优化向前追加逻辑
    } else if (isSameVnode(oldEndVnode, newEndVnode)) {
      patch(oldEndVnode, newEndVnode); // 比较孩子
      oldEndVnode = oldChildren[--oldEndIndex];
      newEndVnode = newChildren[--newEndIndex];
    }
  }
  if (newStartIndex <= newEndIndex) {
    for (let i = newStartIndex; i <= newEndIndex; i++) {
      let ele =
        newChildren[newEndIndex + 1] == null
          ? null
          : newChildren[newEndIndex + 1].el;
      parent.insertBefore(createElm(newChildren[i]), ele);
    }
  }
}
```

### 头移尾、尾移头

```js
// 头移动到尾部
else if(isSameVnode(oldStartVnode,newEndVnode)){
    patch(oldStartVnode,newEndVnode);
    parent.insertBefore(oldStartVnode.el,oldEndVnode.el.nextSibling);
    oldStartVnode = oldChildren[++oldStartIndex];
    newEndVnode = newChildren[--newEndIndex]
// 尾部移动到头部
}else if(isSameVnode(oldEndVnode,newStartVnode)){
    patch(oldEndVnode,newStartVnode);
    parent.insertBefore(oldEndVnode.el,oldStartVnode.el);
    oldEndVnode = oldChildren[--oldEndIndex];
    newStartVnode = newChildren[++newStartIndex]
}
```

> 以上四个条件对常见的 dom 操作进行了优化

### 暴力比对

```js
function makeIndexByKey(children) {
  let map = {};
  children.forEach((item, index) => {
    map[item.key] = index;
  });
  return map;
}
let map = makeIndexByKey(oldChildren);
```

> 对所有的孩子元素进行编号

```js
let moveIndex = map[newStartVnode.key];
if (moveIndex == undefined) {
  // 老的中没有将新元素插入
  parent.insertBefore(createElm(newStartVnode), oldStartVnode.el);
} else {
  // 有的话做移动操作
  let moveVnode = oldChildren[moveIndex];
  oldChildren[moveIndex] = undefined;
  parent.insertBefore(moveVnode.el, oldStartVnode.el);
  patch(moveVnode, newStartVnode);
}
newStartVnode = newChildren[++newStartIndex];
```

> 用新的元素去老的中进行查找，如果找到则移动，找不到则直接插入

```js
if (oldStartIndex <= oldEndIndex) {
  for (let i = oldStartIndex; i <= oldEndIndex; i++) {
    let child = oldChildren[i];
    if (child != undefined) {
      parent.removeChild(child.el);
    }
  }
}
```

> 如果有剩余则直接删除

```js
if (!oldStartVnode) {
  oldStartVnode = oldChildren[++oldStartIndex];
} else if (!oldEndVnode) {
  oldEndVnode = oldChildren[--oldEndIndex];
}
```

在比对过程中，可能出现空值情况则直接跳过

## Vue3 Dom Diff

### 前后元素不一致

> 两个不同虚拟节点不需要进行比较，直接移除老节点，将新的虚拟节点渲染成真实 DOM 进行挂载即可

```js
export const isSameVNodeType = (n1, n2) => {
  return n1.type === n2.type && n1.key === n2.key;
};
const patch = (n1, n2, container) => {
  // 初始化和diff算法都在这里喲
  if (n1 == n2) {
    return;
  }
  if (n1 && !isSameVNodeType(n1, n2)) {
    // 有n1 是n1和n2不是同一个节点
    unmount(n1);
    n1 = null;
  }
  if (n1 == null) {
    // 初始化的情况
    mountElement(n2, container);
  } else {
    // diff算法
  }
};
```

### 前后元素一致

```js
const patchElement = (n1, n2) => {
  let el = (n2.el = n1.el);
  const oldProps = n1.props || {};
  const newProps = n2.props || {};
  patchProps(oldProps, newProps, el); // 比对新老属性
  patchChildren(n1, n2, el); // 比较元素的孩子节点
};
const processElement = (n1, n2, container) => {
  if (n1 == null) {
    mountElement(n2, container);
  } else {
    patchElement(n1, n2); // 比较两个元素
  }
};
```

### 子元素比较情况

| 新儿子 | 旧儿子 | 操作方式                     |
| :----- | :----- | :--------------------------- |
| 文本   | 数组   | （删除老儿子，设置文本内容） |
| 文本   | 文本   | （更新文本即可）             |
| 文本   | 空     | （更新文本即可) 与上面的类似 |
| 数组   | 数组   | （diff 算法）                |
| 数组   | 文本   | （清空文本，进行挂载）       |
| 数组   | 空     | （进行挂载） 与上面的类似    |
| 空     | 数组   | （删除所有儿子）             |
| 空     | 文本   | （清空文本）                 |
| 空     | 空     | （无需处理）                 |

```js
const unmountChildren = (children) => {
  for (let i = 0; i < children.length; i++) {
    unmount(children[i]);
  }
};
const patchChildren = (n1, n2, el) => {
  const c1 = n1 && n1.children;
  const c2 = n2.children;
  const prevShapeFlag = n1.shapeFlag;
  const shapeFlag = n2.shapeFlag;
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      unmountChildren(c1);
    }
    if (c1 !== c2) {
      hostSetElementText(el, c2);
    }
  } else {
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      } else {
        unmountChildren(c1);
      }
    } else {
      if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
        hostSetElementText(el, '');
      }
      if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        mountChildren(c2, el);
      }
    }
  }
};
```
