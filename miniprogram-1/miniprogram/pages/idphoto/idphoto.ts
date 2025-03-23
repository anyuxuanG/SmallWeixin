Component({
  data: {
    imagePath: '',
    processedImagePath: '',
    mattedImagePath: '', // 抠图后的照片路径
    currentSpec: 'one', // one, two, passport
    bgColor: 'white', // white, blue, red, gray
    currentBgColorCode: '#ffffff', // 当前背景色的CSS代码
    isProcessing: false,
    processingProgress: 0, // 处理进度
    imageInfo: null as any, // 图片信息
    
    // 裁剪相关状态
    isCropping: false,
    cropBoxWidth: 295, // 一寸默认宽度(px)
    cropBoxHeight: 413, // 一寸默认高度(px)
    cropBoxTop: 0,
    cropBoxLeft: 0,
    originalImageInfo: null as any, // 原始图片信息
    cropImagePath: '', // 裁剪后的图片路径
    
    // 缩放相关
    scaleValue: 1,
    imageX: 0,
    imageY: 0,
    imageScale: 1,
    
    // 修改初始步骤为第一步：选择规格
    currentStep: 1, // 1: 选择规格, 2: 上传照片, 3: 完成
    processingStatus: '处理中...',
    
    // 结果提示信息
    result_tips: ''
  },
  properties: {
    // 添加组件属性，如果有的话
  },
  // 定义组件自己的属性
  canvasNode: null as WechatMiniprogram.Canvas | null,
  canvasContext: null as WechatMiniprogram.CanvasContext | null,
  lifetimes: {
    // 页面加载时提前初始化Canvas以提高性能
    attached() {
      // 初始化背景色
      this.updateBackgroundColor();
      // 预加载Canvas
      this.preloadCanvas();
    }
  },
  methods: {
    // 预加载Canvas
    preloadCanvas() {
      setTimeout(() => {
        const query = this.createSelectorQuery();
        query.select('#idPhotoCanvas')
          .fields({ node: true, size: true })
          .exec((res) => {
            // 确保Canvas正确获取
            if (res && res[0] && res[0].node) {
              this.canvasNode = res[0].node;
              this.canvasContext = this.canvasNode.getContext('2d');
            }
          });
      }, 500);
    },
    
    // 选择图片 - 修改不自动生成
    chooseImage() {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const tempFilePath = res.tempFiles[0].tempFilePath;
          
          // 先重置所有状态，确保完全清除之前的处理结果
          this.setData({
            imagePath: '',
            processedImagePath: '',
            mattedImagePath: '',
            isCropping: false,
            isProcessing: false,
            processingProgress: 0,
            scaleValue: 1,
            imageX: 0,
            imageY: 0,
            imageScale: 1,
            imageInfo: null,
            originalImageInfo: null,
            cropImagePath: ''
          }, () => {
            // 延迟一下再设置新图片，确保之前的图片和状态已完全清除
            setTimeout(() => {
              // 获取图片信息
              wx.getImageInfo({
                src: tempFilePath,
                success: (imgInfo) => {
                  this.setData({
                    imagePath: tempFilePath,
                    imageInfo: imgInfo,
                    originalImageInfo: imgInfo
                  });
                }
              });
            }, 100);
          });
        }
      });
    },
    
    // 缩放图片
    onScaleImage(e: any) {
      this.setData({
        imageScale: e.detail.scale
      });
    },
    
    // 移动图片
    onMoveImage(e: any) {
      this.setData({
        imageX: e.detail.x,
        imageY: e.detail.y
      });
    },
    
    // 切换到指定步骤
    goToStep(e: any) {
      const step = parseInt(e.currentTarget.dataset.step);
      
      // 验证步骤切换是否合法
      if (step < this.data.currentStep) {
        // 允许返回到之前的步骤
        this.setData({ currentStep: step });
      } else if (step === 2 && this.data.currentStep === 1) {
        // 从步骤1到步骤2，需要已选择规格
        this.setData({ currentStep: step });
      } else if (step === 3) {
        // 到步骤3有两种情况
        if (this.data.processedImagePath) {
          // 1. 已有处理好的图片，直接跳转
          this.setData({ currentStep: step });
        } else if (this.data.imagePath && this.data.currentStep === 2) {
          // 2. 有上传的图片但未处理，先提示需要生成证件照
          wx.showToast({
            title: '请先生成证件照',
            icon: 'none'
          });
        } else {
          // 3. 其他情况，提示需要上传照片
          wx.showToast({
            title: '请先上传并处理照片',
            icon: 'none'
          });
        }
      }
    },
    
    // 下一步
    nextStep() {
      const nextStep = this.data.currentStep + 1;
      if (nextStep <= 3) {
        this.setData({ currentStep: nextStep });
      }
    },
    
    // 上一步
    prevStep() {
      const prevStep = this.data.currentStep - 1;
      if (prevStep >= 1) {
        this.setData({ currentStep: prevStep });
      }
    },
    
    // 开始裁剪增强版
    startCropping() {
      if (!this.data.imagePath || !this.data.imageInfo) {
        wx.showToast({
          title: '请先上传照片',
          icon: 'none'
        });
        return;
      }
      
      // 获取系统信息以计算裁剪框位置
      wx.getSystemInfo({
        success: (sysInfo) => {
          // 获取当前规格对应的裁剪框尺寸
          const size = this.getSpecSize();
          
          // 计算屏幕中心位置（考虑预览区域的大小）
          const screenWidth = sysInfo.windowWidth;
          // 使用60%的屏幕高度作为预览区
          const previewHeight = sysInfo.windowHeight * 0.6;
          
          // 确保裁剪框完全在可视区域内
          const maxWidth = screenWidth * 0.8;
          const maxHeight = previewHeight * 0.8;
          
          // 如果裁剪框原始尺寸太大，按比例缩小
          let cropWidth = size.width;
          let cropHeight = size.height;
          
          if (cropWidth > maxWidth || cropHeight > maxHeight) {
            const ratioW = maxWidth / cropWidth;
            const ratioH = maxHeight / cropHeight;
            const ratio = Math.min(ratioW, ratioH);
            
            cropWidth = Math.floor(cropWidth * ratio);
            cropHeight = Math.floor(cropHeight * ratio);
          }
          
          // 裁剪框居中显示
          const cropBoxLeft = (screenWidth - cropWidth) / 2;
          const cropBoxTop = (previewHeight - cropHeight) / 2;
          
          // 重置图片的位置和缩放
          this.setData({
            isCropping: true,
            cropBoxWidth: cropWidth,
            cropBoxHeight: cropHeight,
            cropBoxLeft: cropBoxLeft,
            cropBoxTop: cropBoxTop,
            scaleValue: 1,
            // 使图片居中显示
            imageX: (screenWidth - cropWidth) / 2,
            imageY: 0
          });
          
          // 提示用户
          wx.showToast({
            title: '拖动照片调整位置',
            icon: 'none',
            duration: 2000
          });
        }
      });
    },
    
    // 确认裁剪增强版
    confirmCrop() {
      const { cropBoxWidth, cropBoxHeight, cropBoxLeft, cropBoxTop, imagePath, imageX, imageY, imageScale } = this.data;
      
      // 显示加载中提示
      wx.showLoading({
        title: '裁剪中...',
        mask: true
      });
      
      // 创建Canvas来裁剪图片
      wx.createSelectorQuery()
        .in(this)
        .select('#idPhotoCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          
          // 设置Canvas大小为裁剪框大小
          canvas.width = cropBoxWidth;
          canvas.height = cropBoxHeight;
          
          // 加载图片
          const image = canvas.createImage();
          image.src = imagePath;
          
          image.onload = () => {
            // 清空Canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // 获取图片信息
            const imgInfo = this.data.imageInfo;
            if (!imgInfo) {
              wx.hideLoading();
              wx.showToast({
                title: '获取图片信息失败',
                icon: 'none'
              });
              return;
            }
            
            // 计算图片在预览区域中的实际尺寸
            const imgWidth = imgInfo.width;
            const imgHeight = imgInfo.height;
            
            // 获取系统信息以计算缩放
            wx.getSystemInfo({
              success: (sysInfo) => {
                const screenWidth = sysInfo.windowWidth;
                
                // 计算图片在屏幕上的显示尺寸
                // 使用mode="widthFix"时，图片宽度会适应容器宽度，高度按原比例计算
                const scale = imageScale || 1;
                const displayWidth = screenWidth * scale;
                const displayHeight = (imgHeight / imgWidth) * displayWidth;
                
                // 计算裁剪参数
                // 需要考虑图片在movable-view中的位置和缩放
                const sourceX = ((cropBoxLeft - imageX) / scale) * (imgWidth / displayWidth);
                const sourceY = ((cropBoxTop - imageY) / scale) * (imgHeight / displayWidth);
                const sourceWidth = (cropBoxWidth / scale) * (imgWidth / displayWidth);
                const sourceHeight = (cropBoxHeight / scale) * (imgHeight / displayWidth);
                
                // 确保裁剪参数在有效范围内
                const validSourceX = Math.max(0, Math.min(sourceX, imgWidth - 1));
                const validSourceY = Math.max(0, Math.min(sourceY, imgHeight - 1));
                const validSourceWidth = Math.min(sourceWidth, imgWidth - validSourceX);
                const validSourceHeight = Math.min(sourceHeight, imgHeight - validSourceY);
                
                // 绘制裁剪后的图片
                ctx.drawImage(
                  image,
                  validSourceX,
                  validSourceY,
                  validSourceWidth,
                  validSourceHeight,
                  0,
                  0,
                  cropBoxWidth,
                  cropBoxHeight
                );
                
                // 转换为临时文件路径
                wx.canvasToTempFilePath({
                  canvas: canvas,
                  quality: 0.95, // 高质量输出
                  success: (res) => {
                    // 更新图片路径和状态
                    wx.getImageInfo({
                      src: res.tempFilePath,
                      success: (newImgInfo) => {
                        this.setData({
                          imagePath: res.tempFilePath,
                          imageInfo: newImgInfo,
                          isCropping: false
                        });
                        
                        wx.hideLoading();
                        wx.showToast({
                          title: '裁剪成功',
                          icon: 'success'
                        });
                      },
                      fail: () => {
                        this.setData({
                          isCropping: false
                        });
                        wx.hideLoading();
                        wx.showToast({
                          title: '获取裁剪后图片信息失败',
                          icon: 'none'
                        });
                      }
                    });
                  },
                  fail: (err) => {
                    console.error('裁剪失败', err);
                    this.setData({ isCropping: false });
                    wx.hideLoading();
                    wx.showToast({
                      title: '裁剪失败',
                      icon: 'error'
                    });
                  }
                });
              },
              fail: () => {
                this.setData({ isCropping: false });
                wx.hideLoading();
                wx.showToast({
                  title: '获取系统信息失败',
                  icon: 'none'
                });
              }
            });
          };
          
          image.onerror = () => {
            console.error('图片加载失败');
            this.setData({ isCropping: false });
            wx.hideLoading();
            wx.showToast({
              title: '图片加载失败',
              icon: 'error'
            });
          };
        });
    },
    
    // 图片加载完成
    onImageLoad(e: any) {
      // 可以获取图片加载后的尺寸
    },
    
    // 选择规格
    selectSpec(e: any) {
      const spec = e.currentTarget.dataset.spec;
      
      this.setData({
        currentSpec: spec
      }, () => {
        // 更新裁剪框尺寸（如果正在裁剪）
        if (this.data.isCropping) {
          this.updateCropBox();
        }
        
        // 如果已经有处理后的图片，根据新规格重新生成
        if (this.data.mattedImagePath && this.data.processedImagePath) {
          this.previewWithBackground(this.data.mattedImagePath);
        }
        
        // 提供反馈
        wx.showToast({
          title: this.getSpecName(spec),
          icon: 'none',
          duration: 1000
        });
      });
    },
    
    // 获取规格名称
    getSpecName(spec: string): string {
      const specNames: {[key: string]: string} = {
        'one': '一寸照片',
        'two': '二寸照片',
        'passport': '护照照片'
      };
      
      return specNames[spec] || '证件照';
    },
    
    // 更新裁剪框尺寸
    updateCropBox() {
      // 获取当前规格对应的裁剪框尺寸
      const size = this.getSpecSize();
      
      // 计算屏幕中心位置
      const screenWidth = wx.getSystemInfoSync().windowWidth;
      const screenHeight = wx.getSystemInfoSync().windowHeight;
      
      // 裁剪框居中显示
      const cropBoxLeft = (screenWidth - size.width) / 2;
      const cropBoxTop = (screenHeight * 0.5 - size.height) / 2;
      
      this.setData({
        cropBoxWidth: size.width,
        cropBoxHeight: size.height,
        cropBoxLeft: cropBoxLeft > 0 ? cropBoxLeft : 0,
        cropBoxTop: cropBoxTop > 0 ? cropBoxTop : 0
      });
    },
    
    // 选择背景色
    selectColor(e: any) {
      const color = e.currentTarget.dataset.color;
      
      this.setData({
        bgColor: color
      }, () => {
        // 更新背景色代码
        this.updateBackgroundColor();
        
        // 如果已经有抠图结果，需要重新生成证件照
        if (this.data.mattedImagePath) {
          this.previewWithBackground(this.data.mattedImagePath);
        }
      });
    },
    
    // 根据颜色名获取颜色代码
    getBgColorCodeByColor(colorName: string): string {
      const colorMap: {[key: string]: string} = {
        'white': '#ffffff',
        'blue': '#2f7fdf',
        'red': '#e74c3c',
        'gray': '#bdc3c7'
      };
      
      return colorMap[colorName] || '#ffffff';
    },
    
    // 显示背景色预览
    showBackgroundColorPreview() {
      const colorCode = this.getBgColorCode();
      
      // 仅更新背景色代码，不重新生成图片
      this.setData({
        currentBgColorCode: colorCode
      });
      
      // 如果已有抠图结果，延迟一小段时间后重新生成预览
      if (this.data.mattedImagePath) {
        setTimeout(() => {
          this.previewWithBackground(this.data.mattedImagePath, false);
        }, 300);
      }
    },
    
    // 更新背景颜色
    updateBackgroundColor() {
      const colorCode = this.getBgColorCode();
      
      // 更新背景色代码
      this.setData({
        currentBgColorCode: colorCode
      });
    },
    
    // 使用指定背景色预览抠图结果
    previewWithBackground(mattedImagePath: string, showSuccessToast: boolean = false) {
      if (!mattedImagePath) return;
      
      // 获取当前规格和背景色
      const size = this.getSpecSize();
      const bgColorCode = this.getBgColorCode();
      
      // 创建Canvas合成图片
      const query = this.createSelectorQuery();
      query.select('#idPhotoCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          // 检查canvas节点是否存在
          if (!res || !res[0] || !res[0].node) {
            console.error('找不到Canvas节点');
            wx.showToast({
              title: '生成失败，请重试',
              icon: 'none'
            });
            return;
          }
          
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          
          // 设置Canvas大小
          canvas.width = size.width;
          canvas.height = size.height;
          
          // 绘制背景色
          ctx.fillStyle = bgColorCode;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // 加载抠图结果
          const image = canvas.createImage();
          
          // 添加错误处理和超时检测
          let imageLoadTimeout: number;
          
          // 设置图像加载超时
          imageLoadTimeout = setTimeout(() => {
            console.error('图像加载超时');
            wx.showToast({
              title: '图像加载失败，请重试',
              icon: 'none'
            });
            this.setData({
              isProcessing: false,
              processingProgress: 0
            });
          }, 10000); // 10秒超时
          
          image.onload = () => {
            // 清除超时计时器
            clearTimeout(imageLoadTimeout);
            
            // 获取图片尺寸
            const imgWidth = image.width;
            const imgHeight = image.height;
            
            // 计算缩放和位置，使图像居中且填满裁剪区域
            let drawWidth, drawHeight, drawX, drawY;
            
            const canvasRatio = canvas.width / canvas.height;
            const imgRatio = imgWidth / imgHeight;
            
            if (canvasRatio > imgRatio) {
              // 画布更宽，图像需要横向填满
              drawWidth = canvas.width;
              drawHeight = drawWidth / imgRatio;
              drawX = 0;
              drawY = (canvas.height - drawHeight) / 2;
            } else {
              // 画布更高，图像需要纵向填满
              drawHeight = canvas.height;
              drawWidth = drawHeight * imgRatio;
              drawX = (canvas.width - drawWidth) / 2;
              drawY = 0;
            }
            
            // 应用平滑渲染以优化边缘
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // 增加合成模式，提高边缘过渡效果
            ctx.globalCompositeOperation = 'source-over';
            
            try {
              // 在背景上绘制抠图结果
              ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
              
              // 转换为临时文件路径
              wx.canvasToTempFilePath({
                canvas: canvas,
                quality: 0.95, // 提高输出质量
                success: (res) => {
                  // 验证临时文件是否可访问
                  try {
                    const fs = wx.getFileSystemManager();
                    fs.accessSync(res.tempFilePath);
                    
                    // 文件可访问，更新状态
                    this.setData({
                      processedImagePath: res.tempFilePath,
                      isProcessing: false,
                      processingProgress: 100
                    });
                    
                    if (showSuccessToast) {
                      wx.showToast({
                        title: '生成成功',
                        icon: 'success'
                      });
                    }
                  } catch (fsErr) {
                    console.error('无法访问生成的临时文件', fsErr);
                    this.setData({
                      isProcessing: false,
                      processingProgress: 0
                    });
                    wx.showToast({
                      title: '生成失败，请重试',
                      icon: 'none'
                    });
                  }
                },
                fail: (err) => {
                  console.error('生成预览失败', err);
                  this.setData({
                    isProcessing: false,
                    processingProgress: 0
                  });
                  wx.showToast({
                    title: '生成失败，请重试',
                    icon: 'none'
                  });
                }
              });
            } catch (drawError) {
              console.error('绘制图像失败', drawError);
              this.setData({
                isProcessing: false,
                processingProgress: 0
              });
              wx.showToast({
                title: '生成失败，请重试',
                icon: 'none'
              });
            }
          };
          
          image.onerror = (err) => {
            // 清除超时计时器
            clearTimeout(imageLoadTimeout);
            
            console.error('加载图片失败', err);
            this.setData({
              isProcessing: false,
              processingProgress: 0
            });
            wx.showToast({
              title: '图像加载失败，请重试',
              icon: 'none'
            });
          };
          
          // 设置图像源
          try {
            image.src = mattedImagePath;
          } catch (srcError) {
            console.error('设置图像源失败', srcError);
            clearTimeout(imageLoadTimeout);
            this.setData({
              isProcessing: false,
              processingProgress: 0
            });
            wx.showToast({
              title: '图像加载失败，请重试',
              icon: 'none'
            });
          }
        });
    },
    
    // 获取规格对应的尺寸（单位：像素）
    getSpecSize(): {width: number, height: number} {
      // 基于300DPI的标准尺寸
      // 1英寸 = 2.54厘米 = 25.4毫米
      // 300DPI = 300点/英寸 = 300 / 25.4 ≈ 11.8点/毫米
      const dpiRatio = 7.8; // 使用200DPI以适应小程序环境
      
      // 标准尺寸（单位：毫米）
      const sizes = {
        'one': { width: 25, height: 35 },       // 一寸照(25×35mm)
        'two': { width: 35, height: 49 },       // 二寸照(35×49mm)
        'passport': { width: 33, height: 48 }   // 护照(33×48mm)
      };
      
      const size = sizes[this.data.currentSpec as keyof typeof sizes];
      
      // 转换为像素
      return {
        width: Math.round(size.width * dpiRatio),
        height: Math.round(size.height * dpiRatio)
      };
    },
    
    // 获取背景色代码
    getBgColorCode(): string {
      return this.getBgColorCodeByColor(this.data.bgColor);
    },
    
    // 生成证件照
    generatePhoto() {
      if (!this.data.imagePath) {
        wx.showToast({
          title: '请先上传照片',
          icon: 'none'
        });
        return;
      }
      
      this.setData({ 
        isProcessing: true,
        processingProgress: 0
      });
      
      // 模拟进度条
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 2;
        if (progress <= 90) {
          this.setData({ processingProgress: progress });
        }
      }, 100);
      
      // 读取文件为Base64
      const fs = wx.getFileSystemManager();
      fs.readFile({
        filePath: this.data.imagePath,
        encoding: 'base64',
        success: (res) => {
          // 调用 remove.bg API 抠图
          this.removeBackground(progressInterval);
        },
        fail: (error) => {
          console.error('读取文件失败', error);
          this.handleProcessingError(progressInterval);
        }
      });
    },
    
    // 调用 remove.bg API 抠出人像
    removeBackground(progressInterval: number) {
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
    
    // 调用 RemoveBG API
    callRemoveBgAPI(base64Image: string, progressInterval: number) {
      const apiKey = 'hYzNjw9PZWkkqfHkSk2raK4Z'; // 替换为你的remove.bg API KEY
      
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
            this.saveMattedImage(buffer, progressInterval);
          } else {
            console.error('API调用失败', res);
            this.handleProcessingError(progressInterval);
            
            // 尝试显示错误信息
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
    
    // 保存抠图结果到临时文件
    saveMattedImage(arrayBuffer: ArrayBuffer, progressInterval: number) {
      const fs = wx.getFileSystemManager();
      const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_idphoto_${Date.now()}.png`;
      
      fs.writeFile({
        filePath: tempFilePath,
        data: arrayBuffer,
        encoding: 'binary',
        success: () => {
          // 保存抠图路径
          this.setData({
            mattedImagePath: tempFilePath
          });
          
          // 创建证件照
          this.createIdPhoto(tempFilePath, progressInterval);
        },
        fail: (error) => {
          console.error('保存临时文件失败', error);
          this.handleProcessingError(progressInterval);
        }
      });
    },
    
    // 创建证件照 - 生成后直接跳转到步骤3，无弹窗
    createIdPhoto(mattedImagePath: string, progressInterval: number) {
      // 先清除可能存在的任何弹窗
      wx.hideToast();
      wx.hideLoading();
      
      // 确保清除之前的处理结果
      this.setData({
        processedImagePath: ''
      }, () => {
        // 根据抠图结果和背景色创建证件照
        this.previewWithBackground(mattedImagePath, false); // 不显示成功提示
        
        // 确保进度到100%
        clearInterval(progressInterval);
        
        // 简化定时器嵌套，改为统一的Promise方式处理
        const setProgress = () => {
          return new Promise(resolve => {
            this.setData({
              processingProgress: 100,
              processingStatus: '处理完成',
              currentStep: 3  // 同时更新步骤指示器
            }, () => {
              setTimeout(resolve, 300);
            });
          });
        };
        
        const hideProcessing = () => {
          return new Promise(resolve => {
            this.setData({ 
              isProcessing: false
            }, () => {
              setTimeout(resolve, 300);
            });
          });
        };
        
        // 链式处理各步骤
        setProgress()
          .then(hideProcessing)
          .then(() => {
            // 确保所有弹窗关闭
            wx.hideToast();
            wx.hideLoading();
            
            // 检查是否有权限保存图片，如果没有权限则不自动保存
            wx.getSetting({
              success: (res) => {
                // 检查processedImagePath是否有效
                if (this.data.processedImagePath) {
                  // 验证文件是否可访问
                  const fs = wx.getFileSystemManager();
                  try {
                    fs.accessSync(this.data.processedImagePath);
                    
                    // 只有在用户已经授权保存到相册的情况下才自动保存
                    if (res.authSetting['scope.writePhotosAlbum']) {
                      // 文件有效且有权限，保存图片
                      this.saveImage(true);
                    } else {
                      // 没有权限，更新界面提示，但不尝试保存
                      console.log('用户未授权保存到相册，跳过自动保存');
                      this.setData({
                        result_tips: '点击"再次保存"将证件照保存到相册'
                      });
                    }
                  } catch (err) {
                    console.error('生成的文件无法访问:', err);
                    // 在文件访问失败时不显示错误提示，避免重复显示错误
                  }
                } else {
                  console.error('processedImagePath为空，无法保存');
                  // 不显示错误提示，避免重复显示错误
                }
              },
              fail: () => {
                // 获取设置失败，不尝试自动保存
                console.log('无法获取用户授权设置，跳过自动保存');
              }
            });
          });
      });
    },
    
    // 处理错误
    handleProcessingError(interval: number) {
      clearInterval(interval);
      this.setData({
        isProcessing: false,
        processingProgress: 0
      });
      wx.showToast({
        title: '处理失败',
        icon: 'error'
      });
    },
    
    // 保存图片到相册
    saveImage(autoSave: boolean = false) {
      if (!this.data.processedImagePath) {
        if (!autoSave) {
          wx.showToast({
            title: '请先生成证件照',
            icon: 'none'
          });
        }
        return;
      }
      
      // 保存前进行文件检查
      const fs = wx.getFileSystemManager();
      try {
        fs.accessSync(this.data.processedImagePath);
      } catch (err) {
        console.error('保存前文件检查失败:', err);
        // 如果是自动保存模式，出错时不显示提示，避免干扰用户体验
        if (!autoSave) {
          wx.showToast({
            title: '图片无法访问，请重新生成',
            icon: 'none'
          });
        }
        return;
      }
      
      // 先显示正在保存
      if (!autoSave) {
        wx.showLoading({
          title: '正在保存...',
          mask: true
        });
      }
      
      wx.saveImageToPhotosAlbum({
        filePath: this.data.processedImagePath,
        success: () => {
          // 先清除可能存在的弹窗
          wx.hideToast();
          wx.hideLoading();
          
          // 立即隐藏处理遮罩
          this.setData({
            isProcessing: false,
            processingProgress: 0
          });
          
          // 更新结果提示
          this.setData({
            result_tips: '证件照已成功保存至相册'
          });
          
          // 如果不是自动保存（用户手动点击"再次保存"按钮），显示简短提示
          if (!autoSave) {
            wx.showToast({
              title: '已保存到相册',
              icon: 'success',
              duration: 1500,
              mask: false
            });
          }
          // 不再调用resetPageState，保留当前状态
        },
        fail: (err) => {
          // 先清除可能存在的弹窗
          wx.hideToast();
          wx.hideLoading();
          
          // 仅在非自动保存模式下记录和显示错误
          if (!autoSave) {
            console.log('保存操作未完成', err);
            
            if (err.errMsg && err.errMsg.indexOf('auth deny') >= 0) {
              wx.showModal({
                title: '保存失败',
                content: '需要您授权保存图片到相册才能完成保存',
                showCancel: true,
                confirmText: '前往授权',
                cancelText: '取消',
                success: (res) => {
                  if (res.confirm) {
                    wx.openSetting({
                      success: (settingRes) => {
                        if (settingRes.authSetting['scope.writePhotosAlbum']) {
                          // 已获得授权，延迟一下再次调用保存
                          setTimeout(() => {
                            this.saveImage(false); // 注意这里使用false，表示非自动模式
                          }, 500);
                        } else {
                          wx.showToast({
                            title: '未授权，无法保存',
                            icon: 'none'
                          });
                        }
                      }
                    });
                  }
                }
              });
            } else if (err.errMsg && err.errMsg.indexOf('cancel') >= 0) {
              // 用户主动取消，不提示任何信息
            } else {
              wx.showToast({
                title: '保存失败，请重试',
                icon: 'error',
                duration: 1500
              });
            }
          }
        },
        complete: () => {
          // 无论成功失败，确保所有系统弹窗都被处理
          setTimeout(() => {
            wx.hideToast();
            wx.hideLoading();
          }, 100);
        }
      });
    },
    
    // 重置页面状态
    resetPageState() {
      // 确保所有系统弹窗都已关闭
      wx.hideToast();
      wx.hideLoading();
      
      // 完全清除页面状态
      this.setData({
        imagePath: '',
        processedImagePath: '',
        mattedImagePath: '',
        currentSpec: 'one',
        bgColor: 'white',
        isProcessing: false,
        processingProgress: 0,
        isCropping: false,
        imageInfo: null,
        originalImageInfo: null,
        cropImagePath: '',
        scaleValue: 1,
        imageX: 0,
        imageY: 0,
        imageScale: 1
      }, () => {
        // 更新背景色
        this.updateBackgroundColor();
      });
    },
    
    // 清除处理后的图片
    clearProcessedImages() {
      // 确保所有系统弹窗都已关闭
      wx.hideToast();
      wx.hideLoading();
      
      // 先重置状态和路径
      this.setData({
        processedImagePath: '',
        isProcessing: false
      }, () => {
        // 提供明确的视觉反馈
        wx.showModal({
          title: '提示',
          content: '已取消保存证件照，您可以重新选择规格和背景色再次生成',
          showCancel: false,
          success: () => {
            // 用户确认后，重新生成证件照
            if (this.data.mattedImagePath) {
              this.previewWithBackground(this.data.mattedImagePath, false);
            }
          }
        });
      });
    },
    
    // 处理照片 - 修改为生成后跳转到步骤3
    processPhoto() {
      if (!this.data.imagePath) {
        wx.showToast({
          title: '请先上传照片',
          icon: 'none'
        });
        return;
      }
      
      this.setData({ 
        isProcessing: true,
        processingProgress: 0,
        processingStatus: '正在处理中...'
      });
      
      // 生成证件照
      this.generatePhoto();
    },
    
    // 返回首页
    goToHome() {
      wx.navigateBack({
        delta: 1
      });
    },
    
    // 重新制作证件照
    startOver() {
      // 确保所有系统弹窗都已关闭
      wx.hideToast();
      wx.hideLoading();
      
      // 完全清除页面状态
      this.setData({
        imagePath: '',
        processedImagePath: '',
        mattedImagePath: '',
        currentSpec: 'one',
        bgColor: 'white',
        isProcessing: false,
        processingProgress: 0,
        isCropping: false,
        imageInfo: null,
        originalImageInfo: null,
        cropImagePath: '',
        scaleValue: 1,
        imageX: 0,
        imageY: 0,
        imageScale: 1,
        currentStep: 1,  // 回到第一步
        result_tips: ''  // 重置结果提示
      }, () => {
        // 更新背景色
        this.updateBackgroundColor();
      });
    },
    
    // 保存到相册（步骤3使用）
    saveToAlbum() {
      // 检查是否有权限，如果没有则请求权限
      wx.getSetting({
        success: (res) => {
          if (!res.authSetting['scope.writePhotosAlbum']) {
            // 请求权限
            wx.authorize({
              scope: 'scope.writePhotosAlbum',
              success: () => {
                // 权限已获取，调用保存
                this.saveImage(false);
              },
              fail: () => {
                // 用户拒绝授权，提示用户前往设置页面授权
                wx.showModal({
                  title: '提示',
                  content: '需要您授权保存图片到相册才能完成保存',
                  showCancel: true,
                  confirmText: '前往授权',
                  cancelText: '取消',
                  success: (modalRes) => {
                    if (modalRes.confirm) {
                      wx.openSetting({
                        success: (settingRes) => {
                          if (settingRes.authSetting['scope.writePhotosAlbum']) {
                            // 已获得授权，可以保存
                            this.saveImage(false);
                          }
                        }
                      });
                    }
                  }
                });
              }
            });
          } else {
            // 已经有权限，直接保存
            this.saveImage(false);
          }
        }
      });
    },
    
    // 分享功能
    onShareAppMessage() {
      return {
        title: '证件照制作工具',
        path: '/pages/idphoto/idphoto',
        imageUrl: this.data.processedImagePath || '/images/share-idphoto.png'
      }
    },
    
    // 取消裁剪
    cancelCrop() {
      this.setData({
        isCropping: false
      });
    }
  }
});