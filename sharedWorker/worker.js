// 存儲所有連接的端口
const connections = []; // 保存所有已連進這個 SharedWorker 的分頁對應的 MessagePort
let sharedCount = 0;

// 廣播訊息給所有連接的分頁
function broadcast(message, excludePort = null) {
  connections.forEach((port) => {
    if (port !== excludePort) {
      port.postMessage(message);
    }
  });
}

// 當有新分頁連接時觸發
onconnect = function (e) {
  const port = e.ports[0];

  // 將新端口加入連接列表
  connections.push(port);

  console.log(`新分頁連接! 當前連接數: ${connections.length}`);

  // 監聽來自此端口的訊息
  port.onmessage = function (event) {
    const { type } = event.data;

    switch (type) {
      case "connect":
        // 發送初始化資料給新連接的分頁
        port.postMessage({
          type: "init",
          value: sharedCount,
          connectionCount: connections.length,
        });

        // 通知其他分頁有新連線
        broadcast(
          {
            type: "new_connection",
          },
          port
        );

        // 更新所有分頁的連線數
        broadcast({
          type: "connections",
          connectionCount: connections.length,
        });
        break;

      case "increment":
        // 增加計數
        sharedCount++;

        // 廣播新值給所有分頁
        broadcast({
          type: "update",
          value: sharedCount,
          connectionCount: connections.length,
        });

        // 也發送給觸發的分頁
        port.postMessage({
          type: "update",
          value: sharedCount,
          connectionCount: connections.length,
        });
        break;

      case "decrement":
        // 減少計數
        sharedCount--;

        // 廣播新值給所有分頁
        broadcast({
          type: "update",
          value: sharedCount,
          connectionCount: connections.length,
        });

        // 也發送給觸發的分頁
        port.postMessage({
          type: "update",
          value: sharedCount,
          connectionCount: connections.length,
        });
        break;

      case "reset":
        // 重置計數
        sharedCount = 0;

        // 廣播新值給所有分頁
        broadcast({
          type: "update",
          value: sharedCount,
          connectionCount: connections.length,
        });

        // 也發送給觸發的分頁
        port.postMessage({
          type: "update",
          value: sharedCount,
          connectionCount: connections.length,
        });
        break;

      case "disconnect":
        // 移除斷開的連接
        const index = connections.indexOf(port);
        if (index > -1) {
          connections.splice(index, 1);
          console.log(`分頁斷開連接! 剩餘連接數: ${connections.length}`);

          // 更新剩餘分頁的連線數
          broadcast({
            type: "connections",
            connectionCount: connections.length,
          });
        }
        break;

      default:
        console.log("未知的訊息類型:", type);
    }
  };

  // 開始監聽此端口
  port.start();
};
