Component({
  data: {
    imagePath: '',
    mattedImagePath: '',
    isProcessing: false,
    processingProgress: 0,
    showOriginal: false // 是否显示原图
  },
  methods: {
    // 选择图片
    chooseImage() {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          this.setData({
            imagePath: res.tempFiles[0].tempFilePath,
            mattedImagePath: '',
            processingProgress: 0,
            showOriginal: false
          });
        }
      });
    },
    
    // 切换原图/结果图显示
    toggleImageView() {
      const currentState = this.data.showOriginal;
      
      if (currentState) {
        // 当前是原图，切换到结果图
        this.setData({
          showOriginal: false
        });
      } else {
        // 当前是结果图，切换到原图
        this.setData({
          showOriginal: true
        });
      }
    },
    
    // 抠图处理
    processMattingImage() {
      if (!this.data.imagePath) {
        wx.showToast({
          title: '请先上传图片',
          icon: 'none'
        });
        return;
      }
      
      this.setData({ 
        isProcessing: true,
        processingProgress: 0,
        showOriginal: false
      });
      
      // 模拟进度条
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 3;
        if (progress <= 90) {
          this.setData({ processingProgress: progress });
        }
      }, 100);
      
      // 读取文件为二进制数据
      const fs = wx.getFileSystemManager();
      try {
        // 读取文件为Base64
        fs.readFile({
          filePath: this.data.imagePath,
          encoding: 'base64',
          success: (res) => {
            // 确保res.data是string类型
            const base64Data = res.data as string;
            this.callRemoveBgAPI(base64Data, progressInterval);
          },
          fail: (error) => {
            console.error('读取文件失败', error);
            this.handleProcessingError(progressInterval);
          }
        });
      } catch (error) {
        console.error('处理文件异常', error);
        this.handleProcessingError(progressInterval);
      }
    },
    
    // 调用RemoveBG API
    callRemoveBgAPI(base64Image: string, progressInterval: number) {
      const apiKey = 'hYzNjw9PZWkkqfHkSk2raK4Z';
      
      wx.request({
        url: 'https://api.remove.bg/v1.0/removebg',
        method: 'POST',
        header: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json'
        },
        data: {
          image_file_b64: base64Image,
          size: 'auto',
          format: 'png'
        },
        responseType: 'arraybuffer',
        success: (res) => {
          if (res.statusCode === 200) {
            // 处理返回的二进制图片数据
            // 确保res.data是ArrayBuffer类型
            const buffer = res.data as ArrayBuffer;
            this.saveRemovedBgImage(buffer, progressInterval);
          } else {
            console.error('API调用失败', res);
            this.handleProcessingError(progressInterval);
            
            // 显示错误信息
            let errorMsg = '抠图失败';
            try {
              // 使用字符串转换处理
              const dataView = new DataView(res.data as ArrayBuffer);
              let decoder = '';
              for (let i = 0; i < dataView.byteLength; i++) {
                decoder += String.fromCharCode(dataView.getUint8(i));
              }
              const errorObj = JSON.parse(decoder);
              errorMsg = errorObj.errors?.[0]?.title || errorMsg;
            } catch (e) {}
            
            wx.showToast({
              title: errorMsg,
              icon: 'none',
              duration: 2000
            });
          }
        },
        fail: (error) => {
          console.error('请求失败', error);
          this.handleProcessingError(progressInterval);
        }
      });
    },
    
    // 保存处理后的图片到临时文件
    saveRemovedBgImage(arrayBuffer: ArrayBuffer, progressInterval: number) {
      const fs = wx.getFileSystemManager();
      const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_matting_${Date.now()}.png`;
      
      fs.writeFile({
        filePath: tempFilePath,
        data: arrayBuffer,
        encoding: 'binary',
        success: () => {
          // 确保进度到100%
          clearInterval(progressInterval);
          
          setTimeout(() => {
            this.setData({
              mattedImagePath: tempFilePath,
              isProcessing: false,
              processingProgress: 100,
              showOriginal: false
            });
            
            wx.showToast({
              title: '抠图完成',
              icon: 'success'
            });
          }, 500);
        },
        fail: (error) => {
          console.error('保存临时文件失败', error);
          this.handleProcessingError(progressInterval);
        }
      });
    },
    
    // 处理抠图失败
    handleProcessingError(interval: number) {
      clearInterval(interval);
      this.setData({
        isProcessing: false,
        processingProgress: 0
      });
      wx.showToast({
        title: '抠图失败',
        icon: 'error'
      });
    },
    
    // 保存图片到相册
    saveImage() {
      if (!this.data.mattedImagePath) {
        wx.showToast({
          title: '请先完成抠图',
          icon: 'none'
        });
        return;
      }
      
      wx.saveImageToPhotosAlbum({
        filePath: this.data.mattedImagePath,
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