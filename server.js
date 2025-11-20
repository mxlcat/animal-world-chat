const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
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

app.use(cors());
app.use(express.json());

// 存储在线用户和消息（内存中）
const onlineUsers = new Map();
const messages = [];

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
  socket.on('send_message', (messageData) => {
    try {
      const newMessage = {
        nick: messageData.nick,
        msg: messageData.msg,
        ts: new Date().toLocaleTimeString(),
        type: 'user'
      };

      // 保存到内存
      messages.push(newMessage);
      // 只保留最近100条
      if (messages.length > 100) {
        messages.shift();
      }

      // 广播消息给所有用户
      io.emit('new_message', newMessage);
      
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
  res.json({ 
    status: 'ok', 
    users: onlineUsers.size,
    message: '动物世界聊天服务器运行正常'
  });
});

// 获取历史消息的 API
app.get('/messages', (req, res) => {
  res.json(messages);
});

// 根路径
app.get('/', (req, res) => {
  res.json({ 
    message: '只因家族动物世界聊天服务器',
    version: '1.0.0'
  });
});

const PORT = process.env.LEANCLOUD_APP_PORT || 3000;
server.listen(PORT, () => {
  console.log(`动物世界聊天服务器运行在端口 ${PORT}`);
});