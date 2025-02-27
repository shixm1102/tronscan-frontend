import {API_URL} from "../constants";
import xhr from "axios/index";
import {tokensMap, tokens20Map} from "../utils/tokensMap.js";

export default class App {

  constructor(options = {}) {
    this.options = options;
    // localStorage.setItem('tokensMap', JSON.stringify(tokensMap));
    this.getTokensMap();
    this.getTokens20Map();
    this.setExternalLinkHandler(null);
  }

  async getTokensMap() {
    let {data} = await xhr.get(`${API_URL}/api/token?showAll=1&limit=500&id_gt=1002400&fields=id,name,precision,abbr,imgUrl`);
    let imgUrl;
    for (var i = 0; i < data.data.length; i++) {
      if (!tokensMap[data.data[i].id]) {
        if(data.data[i].imgUrl){
            imgUrl = data.data[i].imgUrl
        }else{
            imgUrl = 'https://coin.top/production/js/20190509074813.png'
        }
        tokensMap[data.data[i].id] = data.data[i].name + '_&&_' + data.data[i].id + '_&&_' + data.data[i].precision+'_&&_'+data.data[i].abbr+'_&&_'+imgUrl;
      }
    }
    localStorage.setItem('tokensMap', JSON.stringify(tokensMap));
  }

  async getTokens20Map() {
      let {data} = await xhr.get(`${API_URL}/api/tokens/overview?start=0&limit=1000&filter=trc20`);
      let imgUrl;
      for (var i = 0; i < data.tokens.length; i++) {
          if (!tokens20Map[data.tokens[i].contractAddress]) {
              if(data.tokens[i].imgUrl){
                  imgUrl = data.tokens[i].imgUrl
              }else{
                  imgUrl = 'https://coin.top/production/js/20190509074813.png'
              }
              tokens20Map[data.tokens[i].contractAddress] = data.tokens[i].name + '_&&_' + data.tokens[i].contractAddress + '_&&_' + data.tokens[i].decimal+'_&&_'+data.tokens[i].abbr+'_&&_'+imgUrl;
          }
      }
      localStorage.setItem('tokens20Map', JSON.stringify(tokens20Map));
  }



  setExternalLinkHandler(handler) {
    this.externalLinkHandler = handler;
  }

  getExternalLinkHandler() {
    return this.externalLinkHandler;
  }
}
