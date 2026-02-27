#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
from app import app, socketio
import logging

logger = logging.getLogger(__name__)

if __name__ == '__main__':
    logger.info("启动 Containly 应用...")
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    socketio.run(app, host='0.0.0.0', port=5001, debug=debug)
