Component({
  data: {
    imagePath: '',
    recognitionType: 'general', // general, ocr, plant
    recognitionResults: [] as Array<{name: string, confidence: number}>,
    isRecognizing: false,
    processingProgress: 0,
    apiResponse: '', // 存储API返回的原始响应
    errorMessage: '' // 存储错误信息
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
            recognitionResults: [],
            apiResponse: '',
            errorMessage: ''
          });
        }
      });
    },
    
    // 设置识别类型
    setRecognitionType(e: any) {
      const type = e.currentTarget.dataset.type;
      this.setData({
        recognitionType: type,
        recognitionResults: [],
        apiResponse: '',
        errorMessage: ''
      });
    },
    
    // 开始识别
    startRecognition() {
      if (!this.data.imagePath) {
        wx.showToast({
          title: '请先上传图片',
          icon: 'none'
        });
        return;
      }
      
      this.setData({ 
        isRecognizing: true,
        processingProgress: 0,
        apiResponse: '',
        errorMessage: ''
      });
      
      // 模拟进度条
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 5;
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
          // 根据图片路径判断图片类型
          const imageFormat = this.getImageFormat(this.data.imagePath);
          
          // 创建带前缀的base64字符串
          const base64WithPrefix = `data:image/${imageFormat};base64,${res.data}`;
          
          // 调用火山引擎API
          this.callVolcanoAPI(base64WithPrefix, imageFormat, progressInterval);
        },
        fail: (error) => {
          console.error('读取文件失败', error);
          this.handleRecognitionError('读取图片失败', progressInterval);
        }
      });
    },
    
    // 获取图片格式
    getImageFormat(filePath: string): string {
      const lowerPath = filePath.toLowerCase();
      if (lowerPath.endsWith('.png')) return 'png';
      if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) return 'jpeg';
      if (lowerPath.endsWith('.webp')) return 'webp';
      // 默认返回jpeg
      return 'jpeg';
    },
    
    // 调用火山引擎API
    callVolcanoAPI(base64Image: string, imageFormat: string, progressInterval: number) {
      /* 
      // 注释掉旧的API调用代码
      const apiKey = 'e2a44939-38f3-4e9b-a758-cff375bc6263';
      
      // 构建请求数据
      const requestData = {
        model: 'ep-20250125153900-7jmrx',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `识别图片${this.getRecognitionPrompt()}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: base64Image
                }
              }
            ]
          }
        ]
      };
      
      wx.request({
        url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        method: 'POST',
        header: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        data: requestData,
        success: (res: any) => {
          clearInterval(progressInterval);
          
          if (res.statusCode === 200 && res.data) {
            try {
              // 解析API响应
              const response = res.data;
              const content = response.choices[0]?.message?.content || '未能识别图片内容';
              
              this.setData({
                apiResponse: content,
                isRecognizing: false,
                processingProgress: 100
              });
              
              wx.showToast({
                title: '识别完成',
                icon: 'success'
              });
            } catch (error) {
              console.error('解析响应失败', error);
              this.handleRecognitionError('解析响应失败', null);
            }
          } else {
            console.error('API调用失败', res);
            this.handleRecognitionError((res.data && res.data.error) ? res.data.error.message : '识别失败', null);
          }
        },
        fail: (error) => {
          console.error('请求失败', error);
          this.handleRecognitionError('网络请求失败', progressInterval);
        }
      });
      */
      
      /*
      // 注释掉模拟数据部分
      // 使用模拟数据代替真实 API 调用
      // 等待一段时间模拟网络请求
      setTimeout(() => {
        clearInterval(progressInterval);
        
        // 根据识别类型提供不同的模拟结果
        let simulatedResponse = '';
        
        switch(this.data.recognitionType) {
          case 'general':
            simulatedResponse = '图片中包含：\n- 一个年轻女性，面带微笑\n- 她穿着白色上衣\n- 背景是浅色的墙壁\n- 整体光线明亮，画面清晰\n\n图片整体是一张人像照片，拍摄质量良好，人物表情自然。';
            break;
          case 'ocr':
            simulatedResponse = '识别到的文字内容：\n\n北京市朝阳区\n文化创意产业园\n东区A栋201室\n联系电话：010-12345678\n营业时间：9:00-18:00';
            break;
          case 'plant':
            simulatedResponse = '植物识别结果：\n\n名称：绿萝 (Epipremnum aureum)\n科属：天南星科绿萝属\n\n特点：\n- 常绿藤本植物\n- 叶片呈心形，表面光滑有光泽\n- 适合室内养殖，有净化空气的作用\n- 喜温暖湿润环境，耐阴性强';
            break;
          default:
            simulatedResponse = '未能识别图片内容';
        }
        
        this.setData({
          apiResponse: simulatedResponse,
          isRecognizing: false,
          processingProgress: 100
        });
        
        wx.showToast({
          title: '识别完成',
          icon: 'success'
        });
      }, 2000);
      */
      
      // 使用修复后的火山引擎API调用代码
      const apiKey = 'e2a44939-38f3-4e9b-a758-cff375bc6263';
      
      // 构建请求数据 - 修正模型名称和请求格式
      const requestData = {
        model: 'ep-20250322202121-l86r2',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: base64Image
                }
              },
              {
                type: 'text',
                text: `识别图片${this.getRecognitionPrompt()}`
              }
            ]
          }
        ]
      };
      
      wx.request({
        url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        method: 'POST',
        header: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        data: requestData,
        success: (res: any) => {
          clearInterval(progressInterval);
          
          if (res.statusCode === 200 && res.data) {
            try {
              // 解析API响应
              const response = res.data;
              const content = response.choices[0]?.message?.content || '未能识别图片内容';
              
              this.setData({
                apiResponse: content,
                isRecognizing: false,
                processingProgress: 100
              });
              
              wx.showToast({
                title: '识别完成',
                icon: 'success'
              });
            } catch (error) {
              console.error('解析响应失败', error);
              this.handleRecognitionError('解析响应失败', null);
            }
          } else {
            console.error('API调用失败', res);
            this.handleRecognitionError((res.data && res.data.error) ? res.data.error.message : '识别失败', null);
          }
        },
        fail: (error) => {
          console.error('请求失败', error);
          this.handleRecognitionError('网络请求失败', progressInterval);
        }
      });
    },
    
    // 根据识别类型获取提示词
    getRecognitionPrompt(): string {
      switch(this.data.recognitionType) {
        case 'general':
          return '，告诉我图片中有什么内容，详细描述。';
        case 'ocr':
          return '，请提取图片中的所有文字，保持原有格式。';
        case 'plant':
          return '，如果图片中有植物，请识别这是什么植物，提供详细信息。';
        default:
          return '';
      }
    },
    
    // 处理识别错误
    handleRecognitionError(message: string, interval: number | null) {
      if (interval) {
        clearInterval(interval);
      }
      
      this.setData({
        isRecognizing: false,
        processingProgress: 0,
        errorMessage: message
      });
      
      wx.showToast({
        title: '识别失败',
        icon: 'error'
      });
    }
  }
});