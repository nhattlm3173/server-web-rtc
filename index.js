const io = require("socket.io")(process.env.PORT, {
  cors: {
    origin: "*", // Cho phép tất cả các nguồn (không khuyến khích dùng trong sản xuất)
    methods: ["GET", "POST"], // Các phương thức được phép
    allowedHeaders: ["my-custom-header"], // Header được phép
    credentials: true, // Cho phép gửi cookie
  },
});
const arrUserInfo = [];
io.on("connection", (socket) => {
  socket.on("USER_REGISTER", (user) => {
    const isExist = arrUserInfo.some((u) => {
      return u.username === user.username;
    });
    // console.log(isExist);
    socket.peerID = user.peerID;
    if (isExist) {
      return socket.emit("REGISTER_FALSE");
    }
    arrUserInfo.push(user);
    socket.emit("ONLINE_LIST", arrUserInfo);
    socket.broadcast.emit("HAVE_NEW_USER", user);
    // console.log(arrUserInfo);
  });
  socket.on("disconnect", () => {
    const index = arrUserInfo.findIndex(
      (user) => user.peerID === socket.peerID
    );
    arrUserInfo.splice(index, 1);
    console.log(socket.peerID);
    io.emit("SOMEONE_DISCONNECT", socket.peerID);
  });
});
