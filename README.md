# Personal LONG Telegram Wallet
This is a personal telegram wallet for native **LONG** that works without a centralized server. 
Everyone installs the wallet in their personal Google account and interacts with it individually and privately. 
You can accept / transfer **LONG** coins, as well as burn coins and receive in return signatures for minting **wLONG** tokens

## How to install personal LONG Wallet

**1.** Get a personal telegram bot token:
   - Go to `@BotFather` on Telegram (https://t.me/botfather) and click **"Start"**. Then click `/newbot` and enter any screen name for the wallet:  
    ![](https://longnetwork.github.io/assets/images/bot_long1_2_3_4.png)  
   - Then, at the prompt, enter the name of the bot, unique in the entire telegram network. 
     It must end in **"Bot"** or **"bot"**. If you entered a unique name, then you will be given a secret telegram-token 
     to interact with the bot:  
    ![](https://longnetwork.github.io/assets/images/bot_long5_6.png)  

**2.** Upload the bot script to the free **Google Apps Script** runtime:
   - Log in to your google account and open the Google Apps Script runtime (https://script.google.com/). 
     Click **"CREATE APPS SCRIPT"**. After downloading the environment editor, clear the default contents of `Code.gs`:  
    ![](https://longnetwork.github.io/assets/images/bot_long7_8.png)  
   - Copy the latest version of the bot script from **GitHub** (https://github.com/longnetwork/telegramWallet/blob/main/Code.gs) 
     to the clipboard and paste it into `Code.gs`:  
    ![](https://longnetwork.github.io/assets/images/bot_long9_10.png)  
   - Now set exactly between the quotation marks in `const TOKEN = '...'` 
     your telegram-token and click the **"Save project"** icon:  
    ![](https://longnetwork.github.io/assets/images/bot_long11.png)  
   - Then click **"Delpoy"** -> **"New deployment"** and wait for the runtime to load. 
     Then select the **"Web app"** deployment type, **"Anyone"** access mode (so that Telegram sees the script) and click **"Deploy"** again:  
    ![](https://longnetwork.github.io/assets/images/bot_long12_13_14.png)  
   - Go through all the Google authorization steps in order to get a unique web application link (you need 5 mouse clicks):  
    ![](https://longnetwork.github.io/assets/images/bot_long15_16_17_18_19.png)  
   - Copy the resulting web app link and paste it exactly between the quotes in `const APP_URL= '...'`. Save the project again! And press **"Run"**:  
    ![](https://longnetwork.github.io/assets/images/bot_long20_21.png)  
   - Finally, go to your personal **Telegram LONG Wallet**, press **"Start"**, and enter the `/help` command:
    ![](https://longnetwork.github.io/assets/images/bot_long22.png)  

*Note. If the runtime takes a long time to load, just refresh the page and try again*  
*Note. Each new deployment generates a new web application link to save in `const APP_URL= '...'`*  
*Note. command `/burn 0 0x...` (with 0 amount) can be used to respond to a request for your **wLONG** token address*  


<br>



### Donate us some BNB to advertise wLONG:

**BNB**: `0x6e04282bb56Dd116d40785ebc3f336b4649A5bCb`  


### Official channels:
[Official LONG team](https://t.me/longteam) |
[LONG team News](https://t.me/longteamnews)

