const base = process.env.NODE_ENV === 'production' ? '/' : '/vue';
const { resolve } = require('path');

module.exports = {
  title: 'Vue 知识库',
  description: 'aslkami vue, pinia, vuex, vue-roter',
  // 扫描srcIncludes里面的 *.md文件
  srcIncludes: ['src'],
  alias: {
    // 为了能在demo中正确的使用  import { X } from 'vue-docs'
    [`vue-docs`]: resolve('./src'),
  },
  base,
  themeConfig: {
    // logo: '../logo.svg',
    nav: [{ text: '介绍', link: '/' }],
    sidebar: [
      // { text: '介绍', link: '/' },
      {
        text: 'Vue',
        link: '/vue/',
        children: [
          { text: '响应式原理', link: '/vue/source/reactive' },
          { text: '组件渲染原理', link: '/vue/source/component' },
          { text: '异步更新原理', link: '/vue/source/aysnc-update' },
          { text: 'Computed原理', link: '/vue/source/computed' },
          { text: 'Watch原理', link: '/vue/source/watch' },
          { text: 'Dom-Diff', link: '/vue/source/dom-diff' },
        ],
      },
      // { text: 'Button', link: '/components/button/' },
      {
        text: 'Pinia',
        link: '/pinia/',
        collapsible: true,
        children: [
          // { text: '111', link: '/components/button/' },
          // { text: '111', link: '/components/button/' },
        ],
      },
    ],
    search: {
      searchMaxSuggestions: 10,
    },
    repo: 'aslkami/vitepress',
    repoLabel: 'Github',
    lastUpdated: true,
    prevLink: true,
    nextLink: true,
  },
};
