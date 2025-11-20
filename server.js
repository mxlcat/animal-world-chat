const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const AV = require('leancloud-storage');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// 配置 CORS
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// LeanCloud 初始化
AV.init({
  appId: process.env.LEANCLOUD_APP_ID,
  appKey: process.env.LEANCLOUD_APP_KEY,
  masterKey: process.env.LEANCLOUD_APP_MASTER_KEY
});

app.use(cors());
app.use(express.json());

// 存储在线用户
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

  // 用户登录
  socket.on('user_login', (userData) => {
    onlineUsers.set(socket.id, userData);
    
    // 广播用户加入消息
    socket.broadcast.emit('user_joined', {
      nick: userData.nick,
      time: new Date().toLocaleTimeString(),
      type: 'system'
    });
    
    console.log(`${userData.nick} 加入了聊天`);
  });

  // 接收聊天消息
  socket.on('send_message', async (messageData) => {
    try {
      // 保存到 LeanCloud 数据库
      const Message = AV.Object.extend('Message');
      const message = new Message();
      await message.save({
        nick: messageData.nick,
        msg: messageData.msg,
        ts: new Date()
      });

      // 广播消息给所有用户
      io.emit('new_message', {
        nick: messageData.nick,
        msg: messageData.msg,
        ts: new Date().toLocaleTimeString(),
        type: 'user'
      });
      
      console.log(`${messageData.nick}: ${messageData.msg}`);
    } catch (error) {
      console.error('保存消息失败:', error);
      socket.emit('message_error', '发送失败');
    }
  });

  // 用户断开连接
  socket.on('disconnect', () => {
    const userData = onlineUsers.get(socket.id);
    if (userData) {
      onlineUsers.delete(socket.id);
      
      // 广播用户离开消息
      socket.broadcast.emit('user_left', {
        nick: userData.nick,
        time: new Date().toLocaleTimeString(),
        type: 'system'
      });
      
      console.log(`${userData.nick} 离开了聊天`);
    }
  });
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok', users: onlineUsers.size });
});

// 获取历史消息的 API
app.get('/messages', async (req, res) => {
  try {
    const query = new AV.Query('Message');
    query.descending('createdAt');
    query.limit(50);
    const messages = await query.find();
    
    const result = messages.map(msg => ({
      id: msg.id,
      nick: msg.get('nick'),
      msg: msg.get('msg'),
      ts: msg.get('createdAt').toLocaleTimeString()
    })).reverse();
    
    res.json(result);
  } catch (error) {
    console.error('获取消息失败:', error);
    res.status(500).json({ error: '获取消息失败' });
  }
});

const PORT = process.env.LEANCLOUD_APP_PORT || 3000;
server.listen(PORT, () => {
  console.log(`动物世界聊天服务器运行在端口 ${PORT}`);
});