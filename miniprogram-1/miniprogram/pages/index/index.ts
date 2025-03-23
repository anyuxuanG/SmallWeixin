// index.ts
// 获取应用实例
const app = getApp<IAppOption>()

Component({
  data: {
    pageLoaded: false
  },
  lifetimes: {
    attached() {
      // 页面创建时执行
      setTimeout(() => {
        this.setData({
          pageLoaded: true
        })
      }, 100)
    }
  },
  methods: {
    // 跳转到不同的功能页面
    navigateTo(e: any) {
      const { url } = e.currentTarget.dataset
      wx.navigateTo({
        url
      })
    },
    
    // 分享小程序
    onShareAppMessage() {
      return {
        title: '图片综合处理工具',
        path: '/pages/index/index',
        imageUrl: '/images/share-image.png'
      }
    }
  }
})
