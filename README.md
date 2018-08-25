# FreshGRLC-Bot.js

1. Make sure node and your prefered package manager is installed. I use [yarn](https://github.com/yarnpkg/yarn/) but the default npm works great. To make sure node is installed run the command below. It should return something like `v10.3.0`
```
node --version
```

2. Next clone and cd into the repo with the command below. If you get an error seperate the command at the `&&` and run them independently.
```
git clone https://github.com/OrangeDrangon/FreshGRLC-Bot.js.git && cd FreshGRLC-Bot.js
```

3. Use your desired package manager to install the dependencies with the command below. The example will be for `npm`   
```
npm install
```

4. Copy the config.example.ts and rename it config.ts. Then fill in the parameters.

5. Build the bot with the command below.
```
npm run build
```

6. Run the bot any time after build with the command below.
```
npm run start
```

Also you need a mongo instance but that is not my job to walk you through.

From there everything should be good to go.
