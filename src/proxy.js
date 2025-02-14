/**
 * Dependencies
 */
var net  = require('net');
var mes  = require('./message');

/**
 * Constructor
 */
var Proxy = function Constructor(ws) {
    this._tcp = null;
    this._from = ws._socket.remoteAddress; // Sửa lại để lấy địa chỉ IP đúng hơn
    this._to = ws.url.substr(1);
    this._ws = ws;

    // Bind sự kiện WebSocket
    this._ws.on('message', this.clientData.bind(this));
    this._ws.on('close', this.close.bind(this));
    this._ws.on('error', this.close.bind(this));

    // Phân tích địa chỉ kết nối
    var args = this._to.split(':');

    // Kiểm tra định dạng "host:port"
    if (args.length !== 2 || isNaN(args[1])) {
        mes.info("Invalid connection target: '%s'", this._to);
        this._ws.close();
        return;
    }

    var host = args[0];
    var port = parseInt(args[1], 10);

    // Kết nối đến server
    mes.info("Requested connection from '%s' to '%s' [ACCEPTED].", this._from, this._to);
    this._tcp = net.connect({ port: port, host: host });

    // Cấu hình kết nối TCP
    this._tcp.setTimeout(0);
    this._tcp.setNoDelay(true);

    // Bind sự kiện TCP
    this._tcp.on('data', this.serverData.bind(this));
    this._tcp.on('close', this.close.bind(this));
    this._tcp.on('error', this.handleError.bind(this));
    this._tcp.on('connect', this.connectAccept.bind(this));
};

/**
 * Xử lý dữ liệu từ Client -> Server
 */
Proxy.prototype.clientData = function (data) {
    if (!this._tcp) return; // Chưa kết nối TCP thì bỏ qua

    try {
        this._tcp.write(data);
    } catch (e) {
        mes.info("Error writing data to TCP: %s", e.message);
    }
};

/**
 * Xử lý dữ liệu từ Server -> Client
 */
Proxy.prototype.serverData = function (data) {
    if (!this._ws || this._ws.readyState !== 1) return; // Kiểm tra WebSocket còn hoạt động không

    try {
        this._ws.send(data);
    } catch (error) {
        mes.info("Error sending data to WebSocket: %s", error.message);
    }
};

/**
 * Xử lý lỗi kết nối
 */
Proxy.prototype.handleError = function (error) {
    mes.info("TCP connection error: %s", error.message);
    this.close();
};

/**
 * Xử lý khi kết nối bị đóng
 */
Proxy.prototype.close = function () {
    if (this._tcp) {
        mes.info("Connection closed from '%s'.", this._to);
        this._tcp.destroy(); // Đảm bảo đóng TCP hoàn toàn
        this._tcp = null;
    }

    if (this._ws) {
        mes.info("Connection closed from '%s'.", this._from);
        this._ws.close();
        this._ws = null;
    }
};

/**
 * Khi server chấp nhận kết nối
 */
Proxy.prototype.connectAccept = function () {
    mes.status("Connection accepted from '%s'.", this._to);
};

/**
 * Xuất module
 */
module.exports = Proxy;
