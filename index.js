'use strict';

import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import { EventEmitter } from 'events';

let isAppRegistered = false;
const { WeChat } = NativeModules;

// Event emitter to dispatch request and response from WeChat.
const emitter = new EventEmitter();

DeviceEventEmitter.addListener('WeChat_Resp', resp => {
  emitter.emit(resp.type, resp);
});

function wrapRegisterApp(nativeFunc) {
  if (!nativeFunc) {
    return undefined;
  }
  return (...args) => {
    if (isAppRegistered) {
      // FIXME(Yorkie): we ignore this error if AppRegistered is true.
      return Promise.resolve(true);
    }
    isAppRegistered = true;
    return new Promise((resolve, reject) => {
      nativeFunc.apply(null, [
        ...args,
        (error, result) => {
          if (!error) {
            return resolve(result);
          }
          if (typeof error === 'string') {
            return reject(new Error(error));
          }
          reject(error);
        },
      ]);
    });
  };
}

function wrapApi(nativeFunc) {
  if (!nativeFunc) {
    return undefined;
  }
  return (...args) => {
    if (!isAppRegistered) {
      return Promise.reject(new Error('registerApp required.'));
    }
    return new Promise((resolve, reject) => {
      nativeFunc.apply(null, [
        ...args,
        (error, result) => {
          if (!error) {
            return resolve(result);
          }
          if (typeof error === 'string') {
            return reject(new Error(error));
          }
          reject(error);
        },
      ]);
    });
  };
}

/**
 * `addListener` inherits from `events` module
 * @method addListener
 * @param {String} eventName - the event name
 * @param {Function} trigger - the function when event is fired
 */
export const addListener = emitter.addListener.bind(emitter);

/**
 * `once` inherits from `events` module
 * @method once
 * @param {String} eventName - the event name
 * @param {Function} trigger - the function when event is fired
 */
export const once = emitter.once.bind(emitter);

/**
 * `removeAllListeners` inherits from `events` module
 * @method removeAllListeners
 * @param {String} eventName - the event name
 */
export const removeAllListeners = emitter.removeAllListeners.bind(emitter);

/**
 * @method registerApp
 * @param {String} appid - the app id
 * @return {Promise}
 */
export const registerApp = wrapRegisterApp(WeChat.registerApp);

/**
 * @method registerAppWithDescription
 * @param {String} appid - the app id
 * @param {String} appdesc - the app description
 * @return {Promise}
 */
export const registerAppWithDescription = wrapRegisterApp(
  WeChat.registerAppWithDescription,
);

/**
 * Return if the wechat app is installed in the device.
 * @method isWXAppInstalled
 * @return {Promise}
 */
export const isWXAppInstalled = wrapApi(WeChat.isWXAppInstalled);

/**
 * Return if the wechat application supports the api
 * @method isWXAppSupportApi
 * @return {Promise}
 */
export const isWXAppSupportApi = wrapApi(WeChat.isWXAppSupportApi);

/**
 * Get the wechat app installed url
 * @method getWXAppInstallUrl
 * @return {String} the wechat app installed url
 */
export const getWXAppInstallUrl = wrapApi(WeChat.getWXAppInstallUrl);

/**
 * Get the wechat api version
 * @method getApiVersion
 * @return {String} the api version string
 */
export const getApiVersion = wrapApi(WeChat.getApiVersion);

/**
 * Open wechat app
 * @method openWXApp
 * @return {Promise}
 */
export const openWXApp = wrapApi(WeChat.openWXApp);

// wrap the APIs
const nativeShareToTimeline = wrapApi(WeChat.shareToTimeline);
const nativeShareToSession = wrapApi(WeChat.shareToSession);
const nativeShareToFavorite = wrapApi(WeChat.shareToFavorite);
const nativeSendAuthRequest = wrapApi(WeChat.sendAuthRequest);
const nativeSendSubscribeMsgReq = wrapApi(WeChat.sendSubscribeMsgReq);

/**
 * @method sendAuthRequest
 * @param {Array} scopes - the scopes for authentication.
 * @return {Promise}
 */
export function sendAuthRequest(scopes, state) {
  return new Promise((resolve, reject) => {
    WeChat.sendAuthRequest(scopes, state, () => {});
    emitter.once('SendAuth.Resp', resp => {
      if (resp.errCode === 0) {
        resolve(resp);
      } else {
        reject(new WechatError(resp));
      }
    });
  });
}

/**
 * 获取一次给用户推送一条订阅消息的机会
 * @method sendSubscribeMsgReq
 * @param {Object} data
 * @param {scene} 重定向后会带上 scene 参数，开发者可以填 0-10000 的整形值，用来标识订阅场值
 * @param {templateId} 订阅消息模板 ID，在微信开放平台提交应用审核通过后获得
 * @param {reserved} 用于保持请求和回调的状态，授权请后原样带回给第三方。该参数可用于防止 csrf 攻击（跨站请求伪造攻击），
 *    建议第三方带上该参数，可设置为简单的随机数加 session 进行校验，开发者可以填写 a-zA-Z0-9 的参数值，最多 128 字节，要求做 urlencode
 */
export function sendSubscribeMsgReq(data) {
  return new Promise((resolve, reject) => {
    nativeSendSubscribeMsgReq(data);
    emitter.once(this.RespType.SubscribeMsg, resp => {
      if (resp.errCode === 0) {
        resolve(resp);
      } else {
        reject(new WechatError(resp));
      }
    });
  });
}

/**
 * Share something to timeline/moments/朋友圈
 * @method shareToTimeline
 * @param {Object} data
 * @param {String} data.thumbImage - Thumb image of the message, which can be a uri or a resource id.
 * @param {String} data.type - Type of this message. Could be {news|text|imageUrl|imageFile|imageResource|video|audio|file}
 * @param {String} data.webpageUrl - Required if type equals news. The webpage link to share.
 * @param {String} data.imageUrl - Provide a remote image if type equals image.
 * @param {String} data.videoUrl - Provide a remote video if type equals video.
 * @param {String} data.musicUrl - Provide a remote music if type equals audio.
 * @param {String} data.filePath - Provide a local file if type equals file.
 * @param {String} data.fileExtension - Provide the file type if type equals file.
 */
export function shareToTimeline(data) {
  return new Promise((resolve, reject) => {
    nativeShareToTimeline(data);
    emitter.once('SendMessageToWX.Resp', resp => {
      if (resp.errCode === 0) {
        resolve(resp);
      } else {
        reject(new WechatError(resp));
      }
    });
  });
}

/**
 * Share something to a friend or group
 * @method shareToSession
 * @param {Object} data
 * @param {String} data.thumbImage - Thumb image of the message, which can be a uri or a resource id.
 * @param {String} data.type - Type of this message. Could be {news|text|imageUrl|imageFile|imageResource|video|audio|file|weapp}
 * @param {String} data.webpageUrl - Required if type equals news. The webpage link to share.
 * @param {String} data.imageUrl - Provide a remote image if type equals image.
 * @param {String} data.videoUrl - Provide a remote video if type equals video.
 * @param {String} data.musicUrl - Provide a remote music if type equals audio.
 * @param {String} data.filePath - Provide a local file if type equals file.
 * @param {String} data.fileExtension - Provide the file type if type equals file.
 *
 * @param {String} data.webpageUrl - 兼容低版本的网页链接
 * @param {String} data.userName - 小程序原始id
 * @param {String} data.path - 小程序页面的路径
 * @param {DataURLString} data.hdImageData - 小程序节点高清大图，小于128k
 * @param {String} data.miniProgramType - oneOf(['release', 'preview', 'develop']) - 小程序分享类型，主要用于开发测试，默认为 release. only for ios.
 */
export function shareToSession(data) {
  return new Promise((resolve, reject) => {
    nativeShareToSession(data);
    emitter.once('SendMessageToWX.Resp', resp => {
      if (resp.errCode === 0) {
        resolve(resp);
      } else {
        reject(new WechatError(resp));
      }
    });
  });
}

/**
 * Share something to favorite
 * @method shareToFavorite
 * @param {Object} data
 * @param {String} data.thumbImage - Thumb image of the message, which can be a uri or a resource id.
 * @param {String} data.type - Type of this message. Could be {news|text|imageUrl|imageFile|imageResource|video|audio|file}
 * @param {String} data.webpageUrl - Required if type equals news. The webpage link to share.
 * @param {String} data.imageUrl - Provide a remote image if type equals image.
 * @param {String} data.videoUrl - Provide a remote video if type equals video.
 * @param {String} data.musicUrl - Provide a remote music if type equals audio.
 * @param {String} data.filePath - Provide a local file if type equals file.
 * @param {String} data.fileExtension - Provide the file type if type equals file.
 */
export function shareToFavorite(data) {
  return new Promise((resolve, reject) => {
    nativeShareToFavorite(data);
    emitter.once('SendMessageToWX.Resp', resp => {
      if (resp.errCode === 0) {
        resolve(resp);
      } else {
        reject(new WechatError(resp));
      }
    });
  });
}

/**
 * wechat pay
 * @param {Object} data
 * @param {String} data.partnerId
 * @param {String} data.prepayId
 * @param {String} data.nonceStr
 * @param {String} data.timeStamp
 * @param {String} data.package
 * @param {String} data.sign
 * @returns {Promise}
 */
export function pay(data) {
  // FIXME(Yorkie): see https://github.com/yorkie/react-native-wechat/issues/203
  // Here the server-side returns params in lowercase, but here SDK requires timeStamp
  // for compatibility, we make this correction for users.
  function correct(actual, fixed) {
    if (!data[fixed] && data[actual]) {
      data[fixed] = data[actual];
      delete data[actual];
    }
  }
  correct('prepayid', 'prepayId');
  correct('noncestr', 'nonceStr');
  correct('partnerid', 'partnerId');
  correct('timestamp', 'timeStamp');

  // FIXME(94cstyles)
  // Android requires the type of the timeStamp field to be a string
  if (Platform.OS === 'android') data.timeStamp = String(data.timeStamp)

  return new Promise((resolve, reject) => {
    WeChat.pay(data, result => {
      if (result) reject(result);
    });
    emitter.once('PayReq.Resp', resp => {
      if (resp.errCode === 0) {
        resolve(resp);
      } else {
        reject(new WechatError(resp));
      }
    });
  });
}

/**
 * promises will reject with this error when API call finish with an errCode other than zero.
 */
export class WechatError extends Error {
  constructor(resp) {
    const message = resp.errStr || resp.errCode.toString();
    super(message);
    this.name = 'WechatError';
    this.code = resp.errCode;

    // avoid babel's limition about extending Error class
    // https://github.com/babel/babel/issues/3083
    if (typeof Object.setPrototypeOf === 'function') {
      Object.setPrototypeOf(this, WechatError.prototype);
    } else {
      this.__proto__ = WechatError.prototype;
    }
  }
}

export const RespType = {
  MiniProgramLaunch: 'MiniProgramLaunch.Resp',
  SubscribeMsg: 'SubscribeMsg.Resp'
}
