const base = process.env.NODE_ENV === 'production' ? '/' : '';
const { resolve } = require('path');

module.exports = {
  title: 'Vue 知识库',
  description: '',
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
      { text: '介绍', link: '/' },
      { text: 'Button', link: '/components/button/' },
      { text: 'Pinia', link: '/pinia/' },
    ],
    search: {
      searchMaxSuggestions: 10,
    },
    repo: 'aslkami/vue-docs',
    repoLabel: 'Github',
    lastUpdated: true,
    prevLink: true,
    nextLink: true,
  },
};
