# 部署到腾讯云香港服务器（供国内访问）

架构：nginx 托管静态站 + Node 服务处理 `/api/interpret`（持有 API key）。
香港节点**无需 ICP 备案**，域名在微信里一般能正常打开。

> ⚠️ 摄像头限制：微信内置浏览器禁用摄像头，用户需点右上角「···」→「在浏览器打开」。
> 站点已内置该提示。

---

## 1. 买服务器

- 腾讯云 → **轻量应用服务器（Lighthouse）** → 地域选 **中国香港**
- 镜像：Ubuntu 22.04（纯净）即可，2C2G 足够
- 防火墙放行端口：**80、443**（22 默认开）

## 2. 域名解析

- 一个域名（哪注册都行，无需备案），加一条 **A 记录**指向服务器公网 IP
- 例：`lenormand.你的域名.com → 1.2.3.4`

## 3. 服务器装环境（SSH 登录后）

```bash
# Node 20 + nginx + pm2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
sudo npm install -g pm2
```

## 4. 本地打包并上传

在你本地项目目录：

```bash
npm run build                      # 产出 dist/
# 上传 dist/ 和 server/ 到服务器
rsync -avz dist/   root@服务器IP:/var/www/lenormand/dist/
rsync -avz server/ root@服务器IP:/var/www/lenormand/server/
```

## 5. 启动 Node 后端（在服务器上）

```bash
cd /var/www/lenormand/server
# 用 pm2 常驻，环境变量里放 key（换成你自己的）
ANTHROPIC_API_KEY='sk-你的key' \
ANTHROPIC_BASE_URL='https://apinebula.com' \
pm2 start interpret-server.mjs --name lenormand-api

pm2 save && pm2 startup   # 开机自启（按提示再执行它打印的一条命令）
```

验证：`curl -N -X POST http://127.0.0.1:3000/api/interpret -H 'Content-Type: application/json' -d '{"question":"测试","cards":[]}'` 应有响应（cards 为空会报上游错误，但说明服务通了）。

## 6. 配置 nginx

```bash
# 把仓库里的 deploy/nginx.conf 传上去，改掉 server_name 里的域名
sudo cp /var/www/lenormand/deploy/nginx.conf /etc/nginx/sites-available/lenormand
sudo ln -sf /etc/nginx/sites-available/lenormand /etc/nginx/sites-enabled/lenormand
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

此时用 `http://你的域名` 应能打开站点。

## 7. 上 HTTPS（摄像头必需！）

> `getUserMedia` 只在 HTTPS 下可用，这步不能省。

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名        # 按提示填邮箱、同意条款
```

完成后 `https://你的域名` 即可，证书自动续期。

---

## 以后更新代码

```bash
# 本地
npm run build
rsync -avz dist/ root@服务器IP:/var/www/lenormand/dist/
# 若改了 server/：
rsync -avz server/ root@服务器IP:/var/www/lenormand/server/ && ssh root@服务器IP 'pm2 restart lenormand-api'
```

## 排查

- **手势卡在教程页**：查浏览器 Network，`/models/hand_landmarker.task`、`/mediapipe/wasm/*` 是否 200；`.wasm` 的 Content-Type 应为 `application/wasm`
- **解读不出字/一直转**：查 `pm2 logs lenormand-api`；确认 nginx 里 `/api/` 段有 `proxy_buffering off`
- **摄像头打不开**：确认是 HTTPS；微信内需「在浏览器打开」
