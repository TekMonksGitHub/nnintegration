const path = require('path');
const fspromises = require('fs/promises');

exports.start = async function(routeName, aiappInfo, messageContainer, message) {  
      try {
            const filePath = message.env.filepath;
            const data = await fspromises.readFile(filePath, 'base64');

            message.content.filename = path.basename(filePath).split('.').slice(0, -1).join('.');
            message.content.data = data; message.content.id = aiappInfo.id; 
            message.content.org = aiappInfo.org; message.content.aiappid = aiappInfo.aiappid;
            message.content.cmspath = `/${aiappInfo.cmspath}`;
            message.content.encoding = "base64";
      } catch (error) {
            LOG.error(`Error reading file for filepath ${message.env.filePath}:`, error);
            message.content = {};
      }

      message.addRouteDone(routeName); messageContainer.add(message);
      message.setGCEligible(true);
}