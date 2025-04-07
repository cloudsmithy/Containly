#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from app import app, socketio
import logging

logger = logging.getLogger(__name__)

if __name__ == '__main__':
    logger.info("启动 Containly 应用...")
    socketio.run(app, host='0.0.0.0', port=5001, debug=True, allow_unsafe_werkzeug=True)
