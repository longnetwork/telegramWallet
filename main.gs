const BOT_VERSION="v0.1"
             //**********:***********************************
const TOKEN = '**********:***********************************'; // from @BotFather Keep it a secret!!!
              //https://script.google.com/macros/s/************************************************************************/exec
const APP_URL= 'https://script.google.com/macros/s/************************************************************************/exec'; // Keep it a secret!!!
// Тип развертывания Web App, Доступно - ВСЕМ (значит сервера телеги смогут обращатся, но публиковать линк НЕЛЬЗЯ!)

const EXPLORER= 'https://explorer.crypton.cf';  // Через какой эксплорер работаем - Спецификация протокола важна!
/* 
Работаем через web-хуки (юзер вошкается в боте - телега реагирует и шлет зпросы на это web-априложение как реакцию на действия юзера)
Также все должно реагировать только на того юзера который создал бота и больше ни на кого!
Также помним, - никакие переменные не сохраняются. Скрип какбы загружается каждый раз заново перед doPost
*/

const CONFIRMATIONS=1;  // Пока входящие не потраченные транзы не набирут столько подтверждений - игнорируются

function initialize(keepID=false) { // Run once after FIRST deployment!
  // Нужно запустить разок после ПЕРВОГО развертывания для связи телеги и бота

  let bot=new Bot();

  let chatID=bot.chatID, bcount=bot.bcount;
  PropertiesService.getScriptProperties().deleteAllProperties();
  if(keepID) bot.chatID= chatID; bot.bcount=bcount; // bcount удерживаем всегда, чтобы при обновлении не читать заново все транзы

  PropertiesService.getScriptProperties().setProperty("version",BOT_VERSION);

  Tapi.setWebhook(APP_URL);

  let triggers = ScriptApp.getProjectTriggers(); for(let trg of triggers) ScriptApp.deleteTrigger(trg);
  ScriptApp.newTrigger("doCron").timeBased().everyMinutes(5).create(); // only 1 5 10 15 30
}
function doLog(){
  Slog.print();
}
function doPost(e) {  // Вот это будет дергать телега через WebHook каждый раз как пользователь что-то вводит
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(45000);

    if(e.postData.type == "application/json") {
      /* e.postData.contents:
      {"update_id":812125550,
      "message":{
        "message_id":170,
        "from":{"id":1311695912,"is_bot":false,"first_name":"Boss","language_code":"ru"},
        "chat":{"id":1311695912,"first_name":"Boss","type":"private"},
        "date":1649660196,"text":"qwerty"
        }
      }*/

      if(PropertiesService.getScriptProperties().getProperty("version")!=BOT_VERSION) { // Обновление скрипта
        initialize(true); // Удерживаем chatID (чтобы не владелиц не сунулся)
        Slog.write("ReInitialize...");
      }

      new Bot().process( JSON.parse(e.postData.contents) );
    }
  }
  catch (err) { // name message stack
    Slog.write(err.stack);
  }
  finally{
    lock.releaseLock();
  }
}
function doCron(){
  try{
    var lock = LockService.getScriptLock();
    lock.waitLock(45000);

    if(!new Bot().chatID) return; // Пока небыло установки владельца ничего запускать не можем

    new Bot().cmdMessages();

  }
  catch(err){// name message stack
    Slog.write(err.stack);
  }
  finally{
    lock.releaseLock();
  }
}

class Bot {

  constructor(){
    this._persistProperty('chatID',Number);
    this._persistProperty('botID',Number);

    this._persistProperty('pubkey');
    this._persistProperty('address');

    this._persistProperty('bcount',Number); // Высота обработанных сообщений в сплошном списке транзакций на адресе

    this._persistProperty('errorCount',Number);

    this.message=null;
    this.chat_id=null;
  }

  process(update){

    this.message= update.message;
    
    if(!this.message || !this.message.from) {
      Slog.write(update)
      return;
    }

    let chat_id = this.message.from.id; this.chat_id=chat_id;
    let no_bot= this.message.from.is_bot===false;

    if(!this.botID) { // Сработает при деплое и обновлении так как botID сбрасывается
      Tapi.setMyCommands([
        { command: 'help', description: 'list commands' },
        { command: 'address', description: 'your address' },
        { command: 'balance', description: 'address balance' },
        { command: 'send', description: 'send money' },
        { command: 'burn', description: 'burn money' },
        { command: 'secret', description: 'your WIF key'}
      ]);
      this.botID= Tapi.getBotID();
      Slog.write(`bot_id: ${this.botID}`);
    }
                                            
    if(!this.chatID && no_bot) { // Сработает при деплое
      // Первое обращение - фиксируем как владельца, чтобы откликаться только на него
      // (Достут только у одного)
      this.chatID=chat_id;
      Slog.write(`chat_id: ${this.chatID}`);
    }

    if(!this.chatID || this.chatID!=chat_id || !no_bot) { // Абъюз - шлем сообщение об ошибке
      Tapi.sendMessage(chat_id,"%*Error%*: Access is denied");  
      return;
    }
    ///////////////////////// Доступ разрешен /////////////////////

    this.handle(this.message)
  }
  handle(message) {
    //Slog.write(message)
    let parts=(message.text && message.text)
        .replace(/[\f\n\r\t\v​\u00A0\u1680​\u180e\u2000​\u2001\u2002​\u2003\u2004​\u2005\u2006​\u2007\u2008​\u2009\u200a​\u2028\u2029​\u2028\u2029​\u202f\u205f​\u3000]/g,'')
        .replace(/ +/g,' ').trim()
        .split(' ',3); // "/command arg0 arg1"

    if(!parts) return;

    let command=parts[0].replace(/^\//,'').trim().toLowerCase();
    let args=parts.slice(1); args.forEach( (val,i,arr) => arr[i]=arr[i].trim() ); // '/' заменяет только первое вхождение без флага g
    

    try {
      switch(command){
        case 'secret':
          this.cmdSecret(args);
          break;
        case 'address':
          this.cmdAddress(args);
          break;
        case 'balance':
          this.cmdBalance(args);
          break;
        case 'send':
          this.cmdSend(args);
          break;
        case 'burn':
          this.cmdBurn(args);
          break;
        case 'help':
          this.cmdHelp(args);
          break;
        // hide commands
        case 'messages':
          this.cmdMessages(args);
          break;

        default:
          this.cmdDefault(args);    
          break;
      }
    }
    catch(err) { // Что-то можно ответить в телегу о специфики ошибки (например блокэксплорер сдох)
      if( !(err instanceof BeingsentError) ) throw err; 
      Tapi.sendMessage(this.chatID,`%*Error%*: ${err.message}`);
      throw err;
    }
  }

  cmdHelp(args){
    let message='%*Commands%*:\n'
    +'/help  -  list commands\n'
    +'/address  -  your address\n'
    +'/balance  -  own or other balance\n'
    +'/send  %_%_address%_%_  %_%_amount%_%_  -  send coin\n'
    +'/burn  %_%_amount%_%_  %_%_Token address%_%_  -  get %*wLONG%* Tokens\n'
    +'/secret  -  your "cold" private key\n'
    +'\n'
    +'https://longnetwork.github.io'

    Tapi.sendMessage(this.chatID,message);
  }

  cmdSecret(args) {
    let wif=Bcn.getPrivKeyWIF(TOKEN);
    Tapi.sendMessage(this.chatID, `%*Your WIF Key%*:\n`
                                 +`%\`${wif}%\``);
  }
  cmdAddress(args) {    
    Tapi.sendMessage(this.chatID, `%*Address%*:\n`
                                 +`%\`${this._getAddress()}%\``);
  }
  cmdBalance(args){
    let address;
    if(args && args.length>0) address=args[0]; // Можно подать произвольный адрес и проверить баланс
    else address=this._getAddress();

    let {balance, unconfirmed}= new Eapi().getaddressbalance(address);

    Tapi.sendMessage(this.chatID, `%*Balance%*:\n`
                                 +`%\`${balance}%\`${unconfirmed && '+' || ''}%|%|${unconfirmed || ''}%|%| %*LONG%*`);
  }
  cmdSend(args) {
    if(!args || args.length<2) throw new BeingsentError("Invalid Arguments");
    
    let recipient=args[0]; let amount=parseInt(args[1]);
    if(recipient.search(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/)<0) throw new BeingsentError("Invalid Address");
    if(isNaN(amount)) throw new BeingsentError("Invalid Amount");

    let txid= new Eapi().sendrawtransaction(this._getAddress(),recipient,amount,Bcn.getPrivKeyWIF(TOKEN));

    //https://explorer.crypton.cf/tx/a65fdd35e7543006bddd33cf4d5f4456ab02ed7515d46e2b10438161af24c6ed
    Tapi.sendMessage(this.chatID,`${EXPLORER}/tx/${txid}`);
  }

  cmdBurn(args) {
    if(!args || args.length<2) throw new BeingsentError("Invalid Arguments");

    let amount=parseInt(args[0]); let token=args[1];
    if(isNaN(amount)) throw new BeingsentError("Invalid Amount");
    if(token.search(/^0x[a-fA-F0-9]{40}$/)<0) throw new BeingsentError("Invalid Token Address (0x...)");

    let txid= new Eapi().sendrawtransaction(this._getAddress(),"1111111111111111111114oLvT2",amount,Bcn.getPrivKeyWIF(TOKEN),token);

    Tapi.sendMessage(this.chatID,`${EXPLORER}/tx/${txid}`);
  }

  cmdDefault(args) {
    throw new BeingsentError("Unknown Command");
  }

  cmdMessages(args){
    let height=new Eapi().getblockcount();
    if(!this.bcount) this.bcount=height; // Начинаем мониторить сообщения при старте только со свежих блоков

    let bcount=this.bcount || 1;
    if(bcount>height) return; // Все уже считано
    
    let hexdatas=new Eapi().getaddressmsgs(this._getAddress(),bcount,height,Bcn.getPrivKeyWIF(TOKEN));
    for(let data of hexdatas){ // {"fromaddress", "hexdata" ,"height"}
      // FIXME Телега может отлупнуть по частоте обращений и вообще при апдейтах серверов
      // Пока в случае отлупа тупо не обновляем bcount, чтобы повторило, но это не должно каcаться
      // ошибок парсенга и отлупов по размерам данных и других связанных с самими сообщениями
      // так как там может быть все что угодно
      // ➢ ➣

      let msg=Bcn._hexToString(data.hexdata);

      msg=msg.replace(/(<[a-zA-Z]+|<\/[a-zA-Z]+)[^>]*>/gs,'');  // Убой тэгов
      if(msg.length>MAX_TEXT) msg=msg.substr(0,MAX_TEXT)+"..."; // Обрезка по ограничениям телеги

      let reply=`%*➢${ (typeof(data)!='undefined') && data && data.fromaddress || 'unknown'}➣%*\n`
              +`${msg}`;

      try {
        Tapi.sendMessage(this.chatID,reply);
      }
      catch(err){ // Далем механиз, чтобы не зацикливаться вечно в поптыках пробится на упавший сервер телеграм
        /*
          400 - НЕВЕРНЫЙ ЗАПРОС (при ошибках парсинга)
          403 - ЗАПРЕЩЕНО
          404 - НЕ НАЙДЕНО
          406 - NOT_ACCEPTABLE (как и BAD REQUEST 400)
          420 - FLOOD
          500 и жругие - ВНУТРЕННИЙ
        */

        let code=Tapi.getErrorCode(err.message);
        if(code==400 || code==406) { // Кривые сообщения в игнор (this.bcount обновится)
          Slog.write("Ignore malformed message");
          continue; 
        }

        this.errorCount=(this.errorCount || 0) +1;
        if(this.errorCount<30) throw err; // doCron предпримет попытку снова все считать через 5 мин

        Slog.write(`Ignore ${this.errorCount} transmission attempts`);
        continue; // (this.bcount обновится)
      }
    
    }
    this.bcount=height+1;
    this.errorCount=0;
  }

  _getAddress() {
    let pubkey=Bcn.getPubKeyHex(TOKEN);

    if(this.address && this.pubkey==pubkey) return this.address; // Кэшированные значения (у нас здесь нет ripemd160)

    Slog.write("Own address request");
    let address= new Eapi().getaddress(pubkey);

    this.address=address; this.pubkey=pubkey;

    return address;
  }

  _persistProperty(name,type) { // value хранятся и извлекаются как строки в PropertiesService 
    // Скрипт при кажом выполнении одноразовый! Никакие переменные не сохраняются (только в PropertiesService)

    console.log(`for: ${this.constructor.name} property ${name}=${PropertiesService.getScriptProperties().getProperty(this.constructor.name+name)}`);
    
    Object.defineProperty(this, name, {
      get() { 
        let val=PropertiesService.getScriptProperties().getProperty(this.constructor.name + name);
        if(type && type==Number) return Number(val);
        else return val;
      },
      set(value) { PropertiesService.getScriptProperties().setProperty(this.constructor.name + name, value); } // value.toString() не явно
    });
  }
}

class BeingsentError extends Error { // Некоторые исключения можно отправить в бота для уведомления о проблемах
  constructor(message) {
    super(message);
    this.name = "BeingsentError";
  }
}

/********************** Общение с rpc-explorer  ***********************************/
const USER_AGENT = `personalWalletBot/${BOT_VERSION} (Web App; Google Apps Script) UrlFetchApp`;
class Eapi {

  constructor(){
    this._persistProperty('cookie');
    this._persistProperty('csrfToken');
  }

  // на Malformed лучше проверять для {} [] через instanceof, для строк и чисел через typeof (более адекватно для литералов)

 
  getblockcount(){
    let height= this.rpcRequest(`getblockcount`);
    if(typeof(height)!='number') throw new BeingsentError("Block-Explorer Malformed");
    height=height-CONFIRMATIONS; if(height<1) height=1;
    return height;
  }

  getaddressmsgs(address, start, end, privkey) { // если start=0 или end=0 то всегда запрашивает все что есть (0 - как не верное значение)
    let txids=this.rpcRequest(`getaddresstxids {"addresses":["${address}"],"start":${start||1},"end":${end||1}}`);
    if(!(txids instanceof Array)) throw new BeingsentError("Block-Explorer Malformed");

    let hexdatas=[]; // Нам нужны только те, где в выходах есть OP_RETURN и мы их сможем расшифровать
    for(let txid of txids){
      let tx=this.rpcRequest(`getrawtransaction "${txid}" 1`);
      if(!(tx instanceof Object)) throw new BeingsentError("Block-Explorer Malformed");
      /*Slog.write(tx)
        {
          "hex":"01000000012a25bb1e79c00000000",
          "txid": "5c73f3ab1989d026a318defb338a118c5fb9007693ea04ce09d508c85b508d52",
          "size": 308,
          "version": 1,
          "locktime": 0,
          "vin": [...],
          "vout": [
            {
              "value": 0.0,
              "valueSat": 0,
              "n": 0,
              "scriptPubKey": {
                "asm": "OP_RETURN 0c0f0e0700f0fdc80f6cd059f37a8a179e89f9884ec66827f4bb4e06b688e47576f200f300056b756b7532",
                "hex": "6a480c0f0e0700f0fdc80f6cd059f37a8f5aa83437c51847be776ee90bf1fe827f4bb4e06b688e47576f200f300056b756b7532",
                "reqSigs": 1,
                "type": "pubkeyhash",
                "addresses": [
                  "1KEpd7pjby87jvuATxAKTgWWFWUxx6opw2"
                ]
              }
            } 
          ],
          "blockhash": "000000000000353116d6b35bc29a093bb96ce9a6c995e38cb65a0aa4696b82e1",
          "height": 614751,
          "confirmations": 42,
          "time": 1650218220,
          "blocktime": 1650218220
        }*/
      if(tx.vout) {
        for(let vout of tx.vout) {
          if(vout.scriptPubKey && vout.scriptPubKey.asm.startsWith('OP_RETURN')){
            let recipient;
            if (vout.scriptPubKey.addresses && vout.scriptPubKey.addresses.includes(address)) 
              recipient=address;

            let data=this.rpcRequest(`decodedata "${vout.scriptPubKey.hex}" "${privkey}"`);
            if(!(data instanceof Object)) throw new BeingsentError("Block-Explorer Malformed");
            /*Slog.write(data)
              {
                "fromaddress": "1PmZiLPbQSMLWosjckKVsqhcjwXgjAaTEW",
                "frompubkey": "02caa2a8a21cf0af3ffd02d95c5aca179e89f9884ec66827f4bb4e06b688e47576",
                "toaddress": "1KEpd7pjby87jvuATxAKTgWWFWUxx6opw2",
                "topubkey": "",
                "hexdata": "6b756b7532",
                "encryption": "no",
                "decryption": "yes"
              }*/

            if(recipient==undefined) recipient=data.toaddress;
            if(recipient!=address || data.decryption!='yes') continue; // Не читабельно

            hexdatas.push({"fromaddress":data.fromaddress, "hexdata":data.hexdata, "height":tx.height}); // тадааа!!!
          }
        }
      }
    }
    
    return hexdatas;
  }

  sendrawtransaction(fromaddress, toaddress, amount, privkey, message=null) { // return txid
    function _fee(size){const SatoshisPerK=1; return Math.floor(SatoshisPerK*size / 1001) +1;} // Из ядра формула fee

    let {utxos, mtxos, height}= this._shotaddressutxos(fromaddress);

    utxos=utxos.filter( (utx,i,utxos)=> height-utx.height >= CONFIRMATIONS 
                                        && mtxos.find( (mtx,i,mtxos)=> mtx.prevtxid==utx.txid )==undefined ); 
    // Из этих подтвержденных можно набирать входы для трат ( [{"txid":"id","vout":n},...] ).
    // Те на которых есть ссылка в mempool-е нельзя трогать еще 
    // FIXME нужен более глубокий просмотр по ссылкам задействованых уже транз, чтобы позволить тратить не дожидаясь возврата сдачи
    
    let hexdata=null;
    if(message) {
      hexdata=this.rpcRequest(`createrawdata "${privkey}" "${toaddress}" "${Bcn._stringToHex(message)}"`);
      if(typeof(hexdata)!='string') throw new BeingsentError("Block-Explorer Malformed");
    }

    let fee=_fee(1000);  // Начальный прогноз fee (1 LONG)
    let tx_hex='';
    do {
      let inputs=[], sum=0
      for(let i=0; i<utxos.length && sum<amount+fee; sum+=utxos[i].satoshis , i++ ) 
        inputs.push(utxos[i]); // Те что покрывают amount+fee
      
      if(sum<amount+fee) throw new BeingsentError("Insufficient Funds");

      // Для createrawtransaction '[{"txid":"myid","vout":0}]' '{"address":0.01}'
      let param0='['+ inputs.reduce((str, utx, i, inputs)=>str+`{"txid":"${utx.txid}","vout":${utx.outputIndex}}`+((i<inputs.length-1)?',':'') ,'') +']';
      // Сдача на свой адрес, если есть
      let param1='{'+  
                    `"${toaddress}":${amount}`+
                    ((sum>amount+fee)?`,"${fromaddress}":${sum-amount-fee}`:'')+
                    ((hexdata)?`,"data":"${hexdata}"`:'')+
                 '}';

      Slog.write(param1)

      let raw= this.rpcRequest(`createrawtransaction ${param0} ${param1}`);
      if(typeof(raw)!='string') throw new BeingsentError("Block-Explorer Malformed");

      let sig= this.rpcRequest(`signrawtransactionwithkey "${raw}" ["${privkey}"]`);
      if(!(sig instanceof Object)) throw new BeingsentError("Block-Explorer Malformed");
      /*Slog.write(sig)
        { 
          hex: '01000000019a8fe3a81c...',
          complete: false,
          errors: 
            [ { txid: '6ab9e001f58f03fb8afa5792f7a9ef6b1dc9ade8849ff33895aac51ca8e38f9a',
                vout: 0,
                scriptSig: '',
                sequence: 4294967295,
                error: 'Operation not valid with the current stack size' } ] 
        }*/
      if(!sig.complete) throw new BeingsentError("Unable to sign Transaction");

      tx_hex=sig.hex;
      let new_fee=_fee(tx_hex.length/2); if(new_fee<=fee) break;

      // fee нужно больше - повторяем
      fee=new_fee;
    } while(true);

    // Наконецто можно загнать транзу в чейн
    let txid= this.rpcRequest(`sendrawtransaction "${tx_hex}"`);
    if(typeof(txid)!='string') throw new BeingsentError("Block-Explorer Malformed");

    return txid;
  }

  getaddressbalance(address){ // return {balance, unconfirmed}
    
    let {utxos, mtxos, height}= this._shotaddressutxos(address);

    // FIXME Не учитывем что можно глубоко копать со ссылками на предыдущие транзы и актуальный баланс не ждать
    // То что в mempool-е с минусом - это уже минус из актуального, а то что с плюсом это + к ожидаемому
    // (пока не попадет в какой-то следующий блок будет висеть в mempool-е)

    let balance=0, unconfirmed=0;

    for(let utx of utxos){
      if(height-utx.height >= CONFIRMATIONS) balance+=utx.satoshis;
      else unconfirmed+=utx.satoshis;
    }

    for(let mtx of mtxos){
      if(mtx.satoshis<0) balance+=mtx.satoshis;
      else unconfirmed+=mtx.satoshis;
    }

    return {'balance': balance, 'unconfirmed': unconfirmed};
  }

  _shotaddressutxos(address) { // return {utxos, mtxos, current height}
    let response,utxos,mtxos,height,blocks;

    do { // Делаем снимок отдельными запросами и нужно чекать, что между запросами не вклинился блок
      response= this.rpcRequest(`getaddressutxos {"addresses":["${address}"],"chainInfo":true}`);
      if(!(response instanceof Object)) throw new BeingsentError("Block-Explorer Malformed");
      /*Slog.write(response)
        {
          "utxos": [
            {
              "address": "1KEpd7pjby87jvuATxAKTgWWFWUxx6opw2",
              "txid": "25fa34b5bfab00116de410514a30889e140ed39a58bd2a57b8d3266ded897390",
              "outputIndex": 1,
              "script": "76a914c80f6cd059f37a8f5aa83437c51847be776ee90b88ac",
              "satoshis": 1000,
              "height": 612889
            }, ...
          ],
          "hash": "00000000000319fed87a52fcf044e2d4e9ec61953e200f5c1780bd676a4740fb",
          "height": 613829
        }*/
      ({utxos, height}= response);

      response= this.rpcRequest(`getaddressmempool {"addresses":["${address}"]}`);
      if(!(response instanceof Array)) throw new BeingsentError("Block-Explorer Malformed");
      /*Slog.write(response)
        [
          {
            "address": "1KEpd7pjby87jvuATxAKTgWWFWUxx6opw2",
            "txid": "61d1ea8b9faa6f8af6a9ae45587fd94c012ebe02aae6323d3d188a8dea1396a4",
            "index": 0,
            "satoshis": -1000,
            "timestamp": 1650100155,
            "prevtxid": "25fa34b5bfab00116de410514a30889e140ed39a58bd2a57b8d3266ded897390",
            "prevout": 1
          }, 
          {
            "address": "1KEpd7pjby87jvuATxAKTgWWFWUxx6opw2",
            "txid": "61d1ea8b9faa6f8af6a9ae45587fd94c012ebe02aae6323d3d188a8dea1396a4",
            "index": 1,
            "satoshis": 899,
            "timestamp": 1650100155
          }
        ]
      */
      mtxos=response;

      blocks= this.rpcRequest(`getblockcount`);
      if(typeof(blocks)!='number') throw new BeingsentError("Block-Explorer Malformed");

    }
    while(blocks!=height); // Вклинился блок - повторить

    return {'utxos': utxos, 'mtxos': mtxos, 'height' :height};
  }

  getaddress(pubkey) {
    let response= this.rpcRequest(`validateaddress ${pubkey}`);
    if(!(response instanceof Object)) throw new BeingsentError("Block-Explorer Malformed");
    /*Slog.write(response)
      {
          "isvalid": true,
          "address": "1KEpd7pjby87jvuATxAKTgWWFWUxx6opw2",
          "scriptPubKey": "76a914c80f6cd059f37a8f5aa83437c51847be776ee90b88ac",
          "ismine": false,
          "iswatchonly": false,
          "isscript": false
      }*/

    let {isvalid, address} = response;
    if(!isvalid || !address) throw new BeingsentError("Invalid Address");

    return address;
  }

  rpcRequest(command){ // Внутренне эксплорер разделяет по пробелам, поэтому сложные команды с JSON объектами делать без пробелов!
                       // 'getaddressbalance {"addresses":["1111111111111111111114oLvT2"]}'
    if(!this.cookie || !this.csrfToken) { // Инициализация сесси
      try{
        if(!this._getRequest(EXPLORER+"/rpc-terminal")) return null; // Ответ будет если все ок и сессия сохранится
      }
      catch(err){ if(err instanceof BeingsentError) throw err;
        throw new BeingsentError("Block-Explorer Connection");
      }
    }

    // Если все с подключение ок то ответ будет без исключения - он может как содержать данные команды,
    // так и ошибки самого rpc или блокировки запрещенных команд:
    // Sorry, that RPC command is blacklisted. If this is your server, you may allow this command by removing it from the 'rpcBlacklist' setting in config.js.
    // [{"message": "Method not found", "code": -32601, "name": "RpcError"}]
    // (При слетевшей сессии - исключение 403 Forbidden)
    try{
      return this._getRpcResult(this._postRequest(EXPLORER+"/rpc-terminal",{cmd: command}));
    }
    catch (err) {if(err instanceof BeingsentError) throw err;
      // Пробуем восстановить сессию и повторяем
      try {
        if(!this._getRequest(EXPLORER+"/rpc-terminal")) return null;

        return this._getRpcResult(this._postRequest(EXPLORER+"/rpc-terminal",{cmd: command}));
      }
      catch(err){ if(err instanceof BeingsentError) throw err;
        throw new BeingsentError("Block-Explorer Connection");
      }
    }
  }

  _getRpcResult(str) { // Там в блок эксплорере обращаются списком команд (batch) и возвращается список результатов в [...]
    //Slog.write(str)
    let ret=str;
    try {
      ret=JSON.parse(str)[0];
      if(ret && typeof(ret)=='object' && 'code' in ret) // Корректный ответ но с ошибкой rpc
          throw new BeingsentError(`${ret.message || "RpcError"}`); 
    } 
    catch (err) { if(err instanceof BeingsentError) throw err;
    } 

    return ret;
  }

  _getRequest(url) {  // Сохраняем cookie и csrfToken
    let headers={'user-agent': USER_AGENT};
    let options = {'method' : 'get', 'headers' : headers};
    let response = UrlFetchApp.fetch(url, options);
    //console.log(response.getAllHeaders())

    if(response.getResponseCode()!=200) return null;

    let cookie=response.getAllHeaders()['Set-Cookie'];
    if(cookie) {
      let s=''; for(let v of cookie) s+=v.split(';',3)[0]+"; "; s= s.length>1 ? s.slice(0,s.length-2) : s;
      this.cookie= s;
      console.log(`cookie: ${this.cookie}`);
    }

    let text=response.getContentText();
    if(text){ // <meta name="csrf-token" content="wuTzFeDV-A-8TicOmuhGQ--EV0LznlzNakDs">
      let csrfToken=text.match(/<meta name="csrf[\w\-]?token" content="([\w\-]+)">/i); // В заголовке страници с терминалом
      csrfToken= csrfToken && csrfToken[1];
      this.csrfToken=csrfToken;
      console.log(`csrfToken: ${this.csrfToken}`);
    }

    return text;
  }
  _postRequest(url,params){
    if(this.csrfToken && params) params._csrf=this.csrfToken; // переменная _csrf из срипта отправки формы

    let headers={'user-agent': USER_AGENT};
    if(this.cookie) headers.Cookie=this.cookie;

    let p=''; for(let k in params) p+= k+'='+params[k]+'&'; p= p.length>0 ? p.slice(0,p.length-1) : p;
    //console.log(`payload: ${p}`);

    let options = {'method' : 'post', 'headers' : headers, 'payload': p};

    let response = UrlFetchApp.fetch(url, options);

    if(response.getResponseCode()!=200) return null;

    return response.getContentText();
  }

  _persistProperty(name,type) { // value хранятся и извлекаются как строки в PropertiesService 
    // Скрипт при кажом выполнении одноразовый! Никакие переменные не сохраняются (только в PropertiesService)

    console.log(`for: ${this.constructor.name} property ${name}=${PropertiesService.getScriptProperties().getProperty(this.constructor.name+name)}`);
    
    Object.defineProperty(this, name, {
      get() { 
        let val=PropertiesService.getScriptProperties().getProperty(this.constructor.name + name);
        if(type && type==Number) return Number(val);
        else return val;
      },
      set(value) { PropertiesService.getScriptProperties().setProperty(this.constructor.name + name, value); } // value.toString() не явно
    });
  }
}
/*******************************************************************************************/

/********************** Низкоуровневые нужные телега-API  ***********************************/
const API_URL='https://api.telegram.org/bot' + TOKEN;
const MAX_TEXT=4096-96;

class Tapi{
  static getErrorCode(err_message) {
    let code=err_message.match(/.*?['"]error_code['"]:([0-9]+)/si);
    return parseInt(code && code[1]); // Может быть NaN
  }

  static setMyCommands(commands) { //[{command:"", description:""},...]
    let url = API_URL + "/setMyCommands?commands=" + encodeURIComponent(JSON.stringify(commands));
    let response = UrlFetchApp.fetch(url);

    return this._getResult(response)
  }
  static getMyCommands(){
    let url = API_URL + "/getMyCommands";
    let response = UrlFetchApp.fetch(url);
    console.log(response.getContentText());

    return this._getResult(response)    
  }

  static getBotID(){
    let url = API_URL + "/getMe";
    let response = UrlFetchApp.fetch(url);  // User - объект

    return this._getResult(response).id; // Может быть undefined
  }
  static sendMessage(chat_id, text) {

    let escaped_text = text.replace(/[\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!`]/gi,'\\$&').replace(/%\\/gi,'');
    // Эксапим все что хочет телега, тогда при форматировании когда это нужно подаем символы форматирования через %:
    // "%* Жирная звездачка * %*" (это позволяет телеге жрать все символы без срыва форматирования MarkdownV2)

    let url = API_URL + "/sendMessage?chat_id=" + chat_id + "&parse_mode=MarkdownV2" + "&text="+ encodeURIComponent(escaped_text);
    
    let response = UrlFetchApp.fetch(url);  // Синхронная хрень

    return this._getResult(response);
  }
  static setWebhook(app_url) {
    let url = API_URL + "/setWebhook?url=" + app_url;
    let response = UrlFetchApp.fetch(url);  // Синхронная хрень
    console.log(response.getContentText());

    return this._getResult(response);
  }
  static _getResult(response) { // Всегда возращает объект, так что доступ из вне через точку без исключения и лишних проверок
    if(!response) return {};
    let result=JSON.parse(response.getContentText());
    if('ok' in result && result.ok==false) return {};
    if('result' in result) return result.result;
    return result || {};
  }

}
/*******************************************************************************************/

/********************************** Blockchain *********************************************/
class Bcn{
  // Здесь нет ripemd160 нужный для вычисления адрес из публичного ключа (а чистая реализация на js большая)
  // Но! это может вычислить сам блок эксплорер (будем его аутсорсить;) командой validateaddress,
  // Которая еще ко всему дает scriptPubKey (для подписи)

  static getPubKeyHex(token) {
    let k=BigInt('0x'+this.getPrivKeyHex(token))
    let Q=EC7.mul(k,EC7_G);

    let prefix= EC7.odd(Q) ? '03': '02';

    return prefix+Q[0].toString(16);
  }

  static getPrivKeyWIF(token) {
    let bytes=this.getPrivKeyBytes(token);

    bytes.unshift(0x80-256); bytes.push(0x01); // mainnet ; compressed

    let h1=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
    let h2=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h1);

    bytes.push(...h2.slice(0,4))

    return this._hexToBase58(this._bytesToHex(bytes));
  }
  static getPrivKeyHex(token) {
    return this._bytesToHex(this.getPrivKeyBytes(token))
  }
  static getPrivKeyBytes(token) { // Генерится из уникального токена телеги
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
  }

  static _hexToBytes(hex) {
    let bytes= new Array();

    for(let i = 0; i < hex.length; i += 2) {
      let val=parseInt(hex.substr(i, 2), 16); val= (val>=0x80) ? val-256 : val;
      bytes.push(val);
    }

    return bytes;
  }

  static _hexToString(hex){
    return new Utilities.newBlob(this._hexToBytes(hex)).getDataAsString();
  }
  static _stringToHex(str){
    return this._bytesToHex(new Utilities.newBlob(str).getBytes());
  }

  static _bytesToHex(bytes) {
    return bytes.reduce((str,chr)=>{ chr = (chr < 0 ? chr + 256 : chr).toString(16); return str + (chr.length==1 ? '0': '') + chr; },'');
  }
  static _hexToBigInt(hex) {return BigInt('0x'+hex)}
  
  static _hexToBase58(hex) {
    const base58 = [1,2,3,4,5,6,7,8,9,
                    'A','B','C','D','E','F','G','H','J','K','L','M','N','P','Q','R','S','T','U','V','W','X','Y','Z',
                    'a','b','c','d','e','f','g','h','i','j','k','m','n','o','p','q','r','s','t','u','v','w','x','y','z'];
    var num = BigInt('0x' + hex);
    const fifty8 = BigInt(58);
    var remainder;
    var b58_encoded_buffer = '';
    while (num > 0) {
        remainder = num % fifty8;
        b58_encoded_buffer = base58[remainder] + b58_encoded_buffer;
        num = num/BigInt(58);
    }
    while ( hex.match(/^00/) ){
        b58_encoded_buffer = '1' + b58_encoded_buffer;
        hex = hex.substring(2);
    }

    return b58_encoded_buffer;
  }
}
/****************************************************************************************/

/********************************** EC7 математика **************************************/
const EC7_P= BigInt(2) ** BigInt(256) - BigInt(2) ** BigInt(32) - BigInt(977);
const EC7_N= BigInt(2) ** BigInt(256) - BigInt("432420386565659656852420866394968145599");
const EC7_G=[
  BigInt("55066263022277343669578718895168534326250603453777594175500187360389116729240"), 
  BigInt("32670510020758816978083085130507043184471273380659243275938904335757337482424")
];
const EC7_Z=[BigInt(0),BigInt(0)];

class EC7 { // Не забываем скаляр k ограничавть по mod N перед применением в mul
  static mod(a,b) { const result = a % b; return result >= BigInt(0) ? result : b + result; }
  static inv(val,modulo){ // 1/val по модулю
    if (val === BigInt(0)) throw new Error('1/val: does not exist');
    if (modulo <= BigInt(0)) throw new Error('modulo: expected positive');
    // Eucledian GCD https://brilliant.org/wiki/extended-euclidean-algorithm/
    let a = this.mod(val, modulo); let b = modulo;
    let [x, y, u, v] = [BigInt(0), BigInt(1), BigInt(1), BigInt(0)];
    while (a !== BigInt(0)) {
      const q = b / a;
      const r = b % a;
      const m = x - u * q;
      const n = y - v * q;
      [b, a] = [a, r];
      [x, y] = [u, v];
      [u, v] = [m, n];
    }
    const gcd = b;
    if (gcd !== BigInt(1)) throw new Error('1/val: does not exist');
    return this.mod(x, modulo);
  }

  static dbl(A) { //A+A (2*A) - вектора
    const X1 = A[0]; const Y1 = A[1];
    const lam = this.mod(BigInt(3) * X1 ** BigInt(2) * this.inv(BigInt(2) * Y1, EC7_P), EC7_P);
    const X3 = this.mod(lam * lam - BigInt(2) * X1, EC7_P);
    const Y3 = this.mod(lam * (X1 - X3) - Y1, EC7_P);
    return [X3, Y3];
  }
  static add(A,B) { // A+B - вектора
    const [X1, Y1, X2, Y2] = [A[0], A[1], B[0], B[1]];
    if (X1 === BigInt(0) || Y1 === BigInt(0)) return B;
    if (X2 === BigInt(0) || Y2 === BigInt(0)) return A;
    if (X1 === X2 && Y1 === Y2) return dbl(A);
    if (X1 === X2 && Y1 === -Y2) return EC7_Z;
    const lam = this.mod((Y2 - Y1) * this.inv(X2 - X1, EC7_P), EC7_P);
    const X3 = this.mod(lam * lam - X1 - X2, EC7_P);
    const Y3 = this.mod(lam * (X1 - X3) - Y1, EC7_P);
    return [X3, Y3];
  }
  static mul(k,A) { // k*A - скаляр на вектор
    let P = EC7_Z;
    let D = A;
    while (k > BigInt(0)) {
      if (k & BigInt(1)) P = this.add(P,D);
      D = this.dbl(D);
      k >>= BigInt(1);
    }
    return P;
  }
  static odd(A) {let Y=A[1]; return (Y % BigInt(2) === BigInt(0)) ? false : true; } // false (for 02-prefix) , true (for 03-prefix)
}
/***************************************************************************************/

/****************** гугл не любит, чтобы за бесплатно было удобно **********************/
const SLOG_SIZE=7;
class Slog {

  static print(){
    let log_str=PropertiesService.getScriptProperties().getProperty('script_log');
    if (log_str!=null) {
      let log=JSON.parse(log_str);
      for(let s of log) console.log(s);
    }
  }
  static write(str){ // Кнтейнер свойств маленький по размеру (около 500к и 9к на value) https://developers.google.com/apps-script/guides/services/quotas
      let log_str=PropertiesService.getScriptProperties().getProperty('script_log');
      if (log_str==null) PropertiesService.getScriptProperties().setProperty('script_log',JSON.stringify([str]));
      else {
        let log=JSON.parse(log_str);
        if(log.length > SLOG_SIZE) log.shift();
        log.push(str)
        PropertiesService.getScriptProperties().setProperty('script_log',JSON.stringify(log));
      }
  }
  static clear(){
    PropertiesService.getScriptProperties().deleteProperty('script_log');
  }

}
/*******************************************************************************************/

