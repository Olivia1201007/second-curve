"""Interactive local launch; credentials exist only in this process."""
from pathlib import Path
from dataclasses import replace
import getpass
import os
import threading
import webbrowser

BASE = Path(__file__).resolve().parent


def main():
    print('第二曲线 · OpenAI 接入版')
    print('网页布局与原版一致，API Key 仅供本机服务使用，不写入网页或文件。')
    if not os.getenv('OPENAI_API_KEY', '').strip():
        key = getpass.getpass('输入 OpenAI API Key（输入内容隐藏；直接回车只预览网页）：').strip()
        if key:
            os.environ['OPENAI_API_KEY'] = key
        del key
    from server import Config, make_server
    try:
        config = Config.from_env()
        try:
            app = make_server(config)
        except OSError as exc:
            if exc.errno not in {48, 98, 10048}:
                raise
            app = make_server(replace(config, port=0))
    except (OSError, ValueError) as exc:
        print('启动失败：' + str(exc))
        input('按回车退出。')
        return
    url = f'http://127.0.0.1:{app.server_address[1]}/'
    print('浏览器地址：' + url)
    print('模型：' + app.config.model)
    print('关闭此窗口即可停止服务。')
    threading.Timer(.6, lambda: webbrowser.open(url)).start()
    try:
        app.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        app.server_close()


if __name__ == '__main__':
    main()
