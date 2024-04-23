   // webpack.config.js
   const path = require('path');

   module.exports = {
     entry: './public/rooksmove.js',
     output: {
       filename: 'bundle.js',
       path: path.resolve(__dirname, 'public'),
     },
     mode: 'development',
     module: {
       rules: [
         {
           test: /\.(png|jpe?g|gif)$/i,
           use: [
             {
               loader: 'file-loader',
               options: {
                 name: '[path][name].[ext]',
                 outputPath: 'assets/',
                 publicPath: 'assets/',
               },
             },
           ],
         },
       ],
     },
   };