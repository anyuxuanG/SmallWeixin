let compressTimer: number | null = null;

Component({
  data: {
    imagePath: '',
    compressedImagePath: '',
    originalSize: '0',  // 原始图片大小，单位KB
    compressedSize: '0', // 压缩后图片大小，单位KB
    compressionRatio: 80, // 默认压缩比例为80%（对应quality=20）
    isCompressing: false,
    compressionProgress: 0, // 压缩进度，0-100
    showSuccessMessage: false, // 是否显示成功提示
    compressionRate: '0' // 压缩率，百分比
  },
  methods: {
    // 选择图片
    chooseImage() {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const tempPath = res.tempFiles[0].tempFilePath;
          const fileSize = res.tempFiles[0].size / 1024; // 转换为KB
          
          this.setData({
            imagePath: tempPath,
            originalSize: fileSize.toFixed(2),
            compressedImagePath: '',
            compressionProgress: 0,
            showSuccessMessage: false
          });
          
          // 自动开始压缩
          this.startCompression();
        }
      });
    },
    
    // 开始压缩流程
    startCompression() {
      if (!this.data.imagePath) return;
      
      this.setData({ 
        isCompressing: true,
        compressionProgress: 0,
        showSuccessMessage: false
      });
      
      // 模拟压缩进度
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 5;
        if (progress <= 90) {
          this.setData({ compressionProgress: progress });
        }
      }, 100);
      
      // 计算实际quality值（反转压缩比例）
      // compressionRatio=80 意味着压缩80%，所以quality应该是20
      const quality = 100 - this.data.compressionRatio;
      
      // 实际调用压缩API
      wx.compressImage({
        src: this.data.imagePath,
        quality: quality,
        success: (res) => {
          // 获取文件系统管理器
          const fs = wx.getFileSystemManager();
          
          // 获取压缩后文件大小
          fs.getFileInfo({
            filePath: res.tempFilePath,
            success: (fileInfo) => {
              const compressedSize = fileInfo.size / 1024; // 转换为KB
              const originalSize = parseFloat(this.data.originalSize);
              const compressionRate = originalSize > 0 
                ? ((1 - compressedSize / originalSize) * 100).toFixed(2) 
                : '0';
              
              // 确保进度到100%
              clearInterval(progressInterval);
              
              setTimeout(() => {
                this.setData({
                  compressedImagePath: res.tempFilePath,
                  compressedSize: compressedSize.toFixed(2),
                  compressionRate: compressionRate,
                  isCompressing: false,
                  compressionProgress: 100,
                  showSuccessMessage: true
                });
              }, 500);
            },
            fail: () => {
              this.handleCompressionError(progressInterval);
            }
          });
        },
        fail: () => {
          this.handleCompressionError(progressInterval);
        }
      });
    },
    
    // 处理压缩失败
    handleCompressionError(interval: number) {
      clearInterval(interval);
      this.setData({
        isCompressing: false,
        compressionProgress: 0
      });
      wx.showToast({
        title: '压缩失败',
        icon: 'error'
      });
    },
    
    // 压缩比例变化
    onCompressionChange(e: any) {
      this.setData({
        compressionRatio: e.detail.value,
        compressedImagePath: '',
        showSuccessMessage: false
      });
      
      if (this.data.imagePath && !this.data.isCompressing) {
        if (compressTimer) {
          clearTimeout(compressTimer);
        }
        compressTimer = setTimeout(() => {
          this.startCompression();
          compressTimer = null;
        }, 500);
      }
    },
    
    // 关闭成功提示
    closeSuccessMessage() {
      this.setData({
        showSuccessMessage: false
      });
    },
    
    // 保存图片
    saveImage() {
      if (!this.data.compressedImagePath) return;
      
      wx.saveImageToPhotosAlbum({
        filePath: this.data.compressedImagePath,
        success: () => {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
        },
        fail: (err) => {
          console.error('保存失败', err);
          wx.showToast({
            title: '保存失败',
            icon: 'error'
          });
        }
      });
    }
  }
});