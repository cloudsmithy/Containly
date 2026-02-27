#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
from flask import Flask
from flask_socketio import SocketIO
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 创建Flask应用
app = Flask(__name__, static_folder='../static', template_folder='../templates')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', os.urandom(24).hex())

# 创建SocketIO实例
socketio = SocketIO(app, cors_allowed_origins=os.environ.get('CORS_ORIGINS', '*'), async_mode='eventlet')

# 导入路由
from app.routes import views, api, websocket
