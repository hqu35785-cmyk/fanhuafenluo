备份说明（可随时恢复「需要解锁」的旧行为）

1. works.js 备份：backups/works.js.before-nolock.js
2. 恢复步骤：
   - 用 backups/works.js.before-nolock.js 覆盖 src/data/works.js
   - 从 index.html 删除 src/no-lock.js 那一行 script
   - 提交并推送

当前模式：无敏感锁定，卡面直接可看、可保存。
