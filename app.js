const STORAGE_KEY = "moneyos-phone-simulator-v11";
const BILL_VALUE = 100;
const TUTORIAL_CASH_GOAL = 200;
const CALL_FEE = 2;
const SMS_FEE = 1;
const MONTH_LENGTH = 30;
const FIRST_NUMBER_TOP_UP = 50;

const carrierPlans = {
  basic: { id: "basic", name: "19 元不够用套餐", price: 19, desc: "1GB 流量、来电显示和大量焦虑，本月有效。" },
  premium: { id: "premium", name: "99 元尊贵套餐", price: 99, desc: "20GB 流量、权益包和一种被尊重的错觉，本月有效。" },
};

const networkFreeApps = new Set(["home", "cash", "store", "carrier"]);

const apps = {
  cash: { name: "点钞", icon: "钱", color: "#40c463", builtin: true },
  phone: { name: "电话", icon: "☎", color: "#2bd66f", builtin: true },
  sms: { name: "短信", icon: "信", color: "#35a7ff", builtin: true },
  store: { name: "应用商店", icon: "店", color: "#1677ff", builtin: true },
  carrier: { name: "营业厅", icon: "号", color: "#ff8f2d", price: 0, desc: "购买手机号、充话费、看一些没用的套餐。" },
  bank: { name: "XX银行", icon: "行", color: "#d72638", price: 0, desc: "办理银行卡，把点钞里的钱转进去。" },
  wallet: { name: "钱包", icon: "付", color: "#00a870", price: 0, desc: "给联系人转账、扫码付款、查看每一笔支出。" },
  billhub: { name: "账单", icon: "账", color: "#0f766e", price: 0, desc: "总览订单、押金、订阅、贷款和每月固定扣款。" },
  food: { name: "外卖", icon: "饭", color: "#ffc533", price: 0, desc: "点餐、买菜、跑腿、会员，全都从银行卡扣钱。" },
  shop: { name: "购物", icon: "买", color: "#ff5fa2", price: 0, desc: "数码、日用、家具、生鲜、奢侈品，像真实电商一样下单。" },
  travel: { name: "旅行", icon: "旅", color: "#21b5b8", price: 0, desc: "机票、火车票、酒店、门票、保险和租车都能订。" },
  cars: { name: "汽车", icon: "车", color: "#4147d5", price: 0, desc: "买车、交保险、保养、停车、加油充电。" },
  property: { name: "房产", icon: "房", color: "#8d5a3b", price: 0, desc: "租房、买房首付、物业费、装修和车位。" },
  services: { name: "缴费", icon: "缴", color: "#6b8f23", price: 0, desc: "水电燃气、医疗挂号、教育、会员、公益捐款。" },
  entertainment: { name: "娱乐", icon: "玩", color: "#9b4dca", price: 0, desc: "电影、演出、游戏充值、运动和内容订阅。" },
  stocks: { name: "炒股", icon: "股", color: "#222", price: 0, desc: "股票、基金、黄金、虚拟币和理财产品。" },
  ride: { name: "出行", icon: "行", color: "#00a1ff", price: 0, desc: "打车、共享单车、ETC、高速费、机场接送和代驾。" },
  local: { name: "本地生活", icon: "生", color: "#ef6c00", price: 0, desc: "保洁、搬家、维修、洗衣、证件照和到店服务。" },
  health: { name: "医疗", icon: "医", color: "#00a88f", price: 0, desc: "问诊、买药、体检、牙科、疫苗和康复服务。" },
  insurance: { name: "保险", icon: "保", color: "#0052cc", price: 0, desc: "医疗险、意外险、财产险、屏幕险、旅游险和重疾险。" },
  credit: { name: "信用", icon: "信", color: "#7a2cff", price: 0, desc: "信用额度、先用后付、现金借款、分期和还款。" },
  subscriptions: { name: "订阅", icon: "续", color: "#d9467f", price: 0, desc: "音乐、办公、云服务、会员、内容和自动续费。" },
  logistics: { name: "快递", icon: "递", color: "#f59e0b", price: 0, desc: "寄件、同城闪送、退货运费、国际件和仓储。" },
  secondhand: { name: "闲置", icon: "闲", color: "#64748b", price: 0, desc: "二手数码、家具、奢侈品、保证金和验机服务。" },
  gov: { name: "政务", icon: "政", color: "#0f766e", price: 0, desc: "交通罚款、证照、社保、公积金、税费和公共服务。" },
  education: { name: "教育", icon: "学", color: "#2563eb", price: 0, desc: "学费、考试报名、家教、证书、教材和留学定金。" },
  beauty: { name: "美业", icon: "美", color: "#db2777", price: 0, desc: "理发、美甲、美容、按摩、写真和医美定金。" },
  pets: { name: "宠物", icon: "宠", color: "#a16207", price: 0, desc: "宠物粮、洗护、疫苗、看病、寄养和宠物保险。" },
  recharge: { name: "充值", icon: "充", color: "#0284c7", price: 0, desc: "游戏点卡、礼品卡、直播打赏、应用内购和数字内容。" },
  social: { name: "社交", icon: "聊", color: "#ef4444", price: 0, desc: "红包、群费、虚拟礼物、相亲会员、内容打赏和付费社群。" },
  rental: { name: "租赁", icon: "租", color: "#7c3aed", price: 0, desc: "数码、服装、工具、迷你仓、共享设备和押金预授权。" },
  office: { name: "办公", icon: "办", color: "#334155", price: 0, desc: "云服务器、域名、SaaS、电子签章、会议室、打印和发票服务。" },
  renovation: { name: "家装", icon: "装", color: "#b45309", price: 0, desc: "设计、建材、家电、安装、软装、监理和装修分期。" },
  parenting: { name: "母婴", icon: "婴", color: "#ec4899", price: 0, desc: "奶粉尿裤、早教、月嫂、托育、儿童医疗、疫苗和保险。" },
  tickets: { name: "票务", icon: "票", color: "#0891b2", price: 0, desc: "演出、体育、展览、电影、抢票加速、改签和纸质票快递。" },
  overseas: { name: "跨境", icon: "汇", color: "#115e59", price: 0, desc: "跨境购物、签证、境外酒店税费、汇款和外币手续费。" },
  legal: { name: "法律", icon: "法", color: "#4338ca", price: 0, desc: "律师咨询、合同审查、诉讼费、公证、仲裁和商标服务。" },
  jobs: { name: "求职", icon: "聘", color: "#0f766e", price: 0, desc: "简历、招聘会员、背调、面试辅导、猎头和搬迁服务。" },
  events: { name: "活动", icon: "礼", color: "#be123c", price: 0, desc: "婚礼、宴会、摄影、会务、派对、团建和活动保险。" },
  security: { name: "安防", icon: "安", color: "#1f2937", price: 0, desc: "智能门锁、监控云存储、隐私安全、数据恢复和家庭报警。" },
};

const contacts = [
  { id: "friend", name: "阿杰", phone: "13900008888", note: "朋友借款/AA 收款", presets: [52, 200, 888] },
  { id: "parent", name: "妈妈", phone: "13800006666", note: "生活费和节日红包", presets: [500, 1000, 3000] },
  { id: "landlord", name: "房东", phone: "13700009999", note: "房租、押金、维修费", presets: [2300, 4600, 6900] },
  { id: "coworker", name: "同事小林", phone: "13600007777", note: "饭钱、打车、项目垫付", presets: [35, 128, 300] },
];

const foodAddressBook = [
  { id: "home", label: "家", address: "上海市浦东新区 MoneyOS 小区 8 号楼 1801", receiver: "张三", phone: "尾号 1234" },
  { id: "office", label: "公司", address: "陆家嘴口袋科技 18F 前台", receiver: "张三", phone: "尾号 9966" },
  { id: "hotel", label: "酒店", address: "人民广场今晚酒店 1208 房", receiver: "张三", phone: "隐私号 95013" },
];

const foodDeliveryModes = [
  { id: "standard", label: "普通配送", fee: 5, eta: "30-45 分钟", promise: "骑手接单后按距离计费" },
  { id: "priority", label: "优先配送", fee: 12, eta: "20-30 分钟", promise: "更快派单，仍可能堵车" },
  { id: "scheduled", label: "预约配送", fee: 3, eta: "18:30-19:00", promise: "预约时段送达，超时赔券" },
];

const foodCoupons = [
  { id: "platform-8", label: "满30减8", discount: 8, min: 30 },
  { id: "brand-18", label: "满120减18", discount: 18, min: 120 },
  { id: "delivery-vip", label: "会员免配送", discount: 5, min: 1, deliveryOnly: true },
  { id: "none", label: "不使用", discount: 0, min: 0 },
];

const foodPhysicalTags = new Set(["外卖", "聚餐", "买菜", "跑腿", "即时零售"]);
const foodPickupTags = new Set(["自取", "团购", "订座"]);

const SHOP_CART_ID = "__shop_cart__";

const shopAddressBook = [
  { id: "home", label: "家", address: "上海市浦东新区 MoneyOS 小区 8 号楼 1801", receiver: "张三", phone: "尾号 1234" },
  { id: "office", label: "公司", address: "陆家嘴口袋科技 18F 前台", receiver: "张三", phone: "尾号 9966" },
  { id: "locker", label: "驿站", address: "MoneyOS 驿站 A 区 03 柜", receiver: "张三", phone: "隐私号 95013" },
];

const shopShippingModes = [
  { id: "standard", label: "普通快递", fee: 8, eta: "2-3 天", promise: "满 199 免基础运费，偏远地区另算" },
  { id: "express", label: "次日达", fee: 18, eta: "明日 18:00 前", promise: "更快发货，夜间下单顺延" },
  { id: "scheduled", label: "预约送装", fee: 80, eta: "预约上门", promise: "大件商品送装一体，电梯和楼层可能加价" },
  { id: "pickup", label: "驿站自提", fee: 0, eta: "到站短信通知", promise: "到站后保管 48 小时，超时催取" },
];

const shopCoupons = [
  { id: "platform-50", label: "满500减50", discount: 50, min: 500 },
  { id: "brand-300", label: "满3000减300", discount: 300, min: 3000 },
  { id: "big-1000", label: "满8000减1000", discount: 1000, min: 8000 },
  { id: "free-shipping", label: "运费券", discount: 18, min: 1, deliveryOnly: true },
  { id: "none", label: "不使用", discount: 0, min: 0 },
];

const shopLargeTags = new Set(["家具", "家电"]);
const shopImportedTags = new Set(["美妆"]);

const travelPassengers = [
  { id: "self", label: "本人", name: "张三", cert: "身份证 310101********1234", phone: "尾号 1234", note: "成人实名出行人" },
  { id: "colleague", label: "同事", name: "李四", cert: "身份证 310101********7788", phone: "尾号 7788", note: "同行成人，需单独核验" },
  { id: "child", label: "儿童", name: "小张", cert: "户口簿 310101********0088", phone: "监护人尾号 1234", note: "儿童/学生票，部分项目需补证件" },
];

const travelDateSlots = [
  { id: "weekday", label: "工作日", feeRate: 0, desc: "普通日价格，库存看起来还算冷静" },
  { id: "weekend", label: "周末", feeRate: 0.12, desc: "周末/热门入住日，平台会轻轻涨价" },
  { id: "holiday", label: "节假日", feeRate: 0.35, desc: "节假日动态调价，价格非常有存在感" },
];

const travelServiceLevels = [
  { id: "basic", label: "基础", fee: 0, desc: "默认座席/房型/车型，能成行但不体面" },
  { id: "comfort", label: "舒适", fee: 68, desc: "选座、含早、优先取车或专人确认" },
  { id: "premium", label: "尊享", fee: 188, desc: "宽座/高楼层/快速通道，把钱花在顺滑感上" },
];

const travelBaggageOptions = [
  { id: "none", label: "无加购", fee: 0, desc: "只按基础额度出行" },
  { id: "checked20", label: "20kg 托运", fee: 160, desc: "航司短信确认，柜台加购更贵" },
  { id: "checked40", label: "40kg 托运", fee: 300, desc: "大件托运，值机柜台更有底气" },
];

const travelRefundRules = [
  { id: "strict", label: "低价严格", feeRate: 0, refundRate: 0.58, desc: "便宜但退改扣得很真实" },
  { id: "standard", label: "标准退改", feeRate: 0.025, refundRate: 0.82, desc: "可退可改，但服务费不会心软" },
  { id: "flex", label: "安心退改", feeRate: 0.07, refundRate: 0.94, desc: "多花一笔，退订时少痛一点" },
];

const travelCoupons = [
  { id: "trip-40", label: "出行满600减40", discount: 40, min: 600 },
  { id: "hotel-80", label: "酒店满900减80", discount: 80, min: 900, tags: ["酒店", "度假"] },
  { id: "holiday-120", label: "节假日满2000减120", discount: 120, min: 2000 },
  { id: "none", label: "不使用", discount: 0, min: 0 },
];

const travelBaggageTags = new Set(["机票", "度假"]);
const travelStayTags = new Set(["酒店", "度假", "预授权"]);
const travelTrafficTags = new Set(["火车票", "机票", "改签", "行李", "权益"]);

const moneyCountryNodes = [
  { id: "northport", name: "北港", kind: "港口", x: 18, y: 18 },
  { id: "snowcapital", name: "雪京", kind: "首都", x: 47, y: 12 },
  { id: "ironwest", name: "铁西", kind: "工业城", x: 12, y: 48 },
  { id: "cloudhub", name: "云仓", kind: "国家分拨中心", x: 45, y: 42 },
  { id: "rivercity", name: "江城", kind: "中转城", x: 67, y: 36 },
  { id: "flowerbay", name: "花湾", kind: "电商城", x: 82, y: 58 },
  { id: "southmarket", name: "南市", kind: "批发城", x: 52, y: 78 },
  { id: "shanghai", name: "MoneyOS 小区", kind: "收货地", x: 74, y: 82 },
];

const shippingCategories = new Set(["shop", "logistics", "secondhand", "parenting", "pets", "tickets", "rental"]);
const shippingKeywords = ["快递", "发货", "寄", "配送", "纸质", "教材", "设备", "套装", "票", "租赁", "退货", "保价"];

const spendCatalogs = {
  store: [
    { id: "paid-app", name: "付费效率 App", price: 68, tag: "付费下载", desc: "一次买断的效率工具，下载后不可退订但可以后悔。", status: "付费 App 已购买" },
    { id: "photo-pro", name: "修图 App 专业版", price: 198, tag: "内购", desc: "解锁滤镜、批处理、云同步和去水印能力。", status: "专业版已解锁", asset: "subscription" },
    { id: "mobile-game-pass", name: "手游季票", price: 328, tag: "游戏", desc: "赛季通行证、限定皮肤和加速成长包。", status: "季票已到账" },
    { id: "cloud-backup", name: "手机云备份年费", price: 238, tag: "云服务", desc: "照片、通讯录、短信和设备备份空间。", status: "云备份已续费", asset: "subscription" },
    { id: "family-share", name: "家庭共享服务", price: 520, tag: "家庭", desc: "共享云空间、儿童账户、家长控制和付款授权。", status: "家庭共享已开通", asset: "subscription" },
    { id: "developer-tip", name: "给独立开发者打赏", price: 30, tag: "打赏", desc: "应用内赞赏，平台抽成后开发者收到一点。", status: "赞赏已送达" },
  ],
  carrier: [
    { id: "phone-bill", name: "话费充值", price: 100, tag: "话费", desc: "银行卡充值话费，到账后可继续打电话。", status: "话费已到账" },
    { id: "data-pack", name: "10GB 流量包", price: 30, tag: "流量", desc: "当月有效，不结转，超出后继续扣。", status: "流量包已生效" },
    { id: "premium-plan", name: "99 元尊贵套餐", price: 99, tag: "套餐", desc: "月租、来电显示、权益包和合约期。", status: "套餐已变更", asset: "subscription" },
    { id: "roaming", name: "境外漫游包", price: 98, tag: "漫游", desc: "三天漫游流量，超量按高价计费。", status: "漫游包已开通" },
    { id: "sim-replace", name: "补换 SIM 卡", price: 20, tag: "补卡", desc: "补卡工本费，需实名核验。", status: "补卡申请已提交" },
    { id: "broadband", name: "家庭宽带月费", price: 129, tag: "宽带", desc: "宽带月费、光猫押金和维护费。", status: "宽带账单已缴" },
  ],
  bank: [
    { id: "sms-alert", name: "账户短信通知年费", price: 36, tag: "通知", desc: "每一笔动账都发短信，钱少了还多扣一笔。", status: "短信通知已续费", asset: "subscription" },
    { id: "card-replace", name: "银行卡挂失补卡", price: 20, tag: "补卡", desc: "挂失、补卡工本费和新卡邮寄。", status: "补卡申请已提交" },
    { id: "transfer-fee", name: "跨行大额转账手续费", price: 15, tag: "转账", desc: "模拟跨行转账通道费，到账时间写着实时但也可能排队。", status: "手续费已扣" },
    { id: "credit-report", name: "个人征信报告", price: 10, tag: "征信", desc: "查询次数、贷款记录、信用卡和公共信息。", status: "征信报告已生成" },
    { id: "safe-box", name: "银行保险箱年租", price: 680, tag: "保险箱", desc: "网点保险箱租金、押金和身份核验。", status: "保险箱已租用", hold: true, refundRate: 0.6 },
    { id: "certificate-deposit", name: "大额存单认购", price: 10000, tag: "存款", desc: "三年期大额存单，提前支取会损失利息。", status: "存单已持有", asset: "holding" },
    { id: "mortgage-evaluate", name: "按揭评估服务费", price: 980, tag: "贷款", desc: "贷款前评估、材料审核、公证和抵押登记预审。", status: "贷款材料已受理" },
  ],
  wallet: [
    { id: "metro", name: "地铁进站扫码", price: 6, tag: "交通", desc: "刷码过闸，生成一条小额交通扣款。", status: "已过闸" },
    { id: "coffee", name: "咖啡店付款码", price: 32, tag: "扫码", desc: "出示付款码购买一杯拿铁。", status: "门店已收款" },
    { id: "parking-meter", name: "路边停车扫码", price: 18, tag: "停车", desc: "按小时缴停车费，直接从银行卡扣款。", status: "停车费已缴" },
    { id: "convenience", name: "便利店付款", price: 46, tag: "零售", desc: "水、纸巾、充电线和一点临时消费。", status: "小票已生成" },
    { id: "power-bank-hold", name: "共享充电宝押金", price: 99, tag: "押金", desc: "扫码借充电宝，先冻结押金，归还后可退。", status: "押金已冻结", hold: true },
    { id: "aa-dinner", name: "群收款 AA 餐费", price: 128, tag: "AA", desc: "别人发起的群收款，你点了确认付款。", status: "AA 已付款" },
    { id: "red-packet", name: "好友红包", price: 188, tag: "红包", desc: "发给朋友的普通红包，确认后无法撤回。", status: "红包已发送", redPacket: true },
    { id: "group-red-packet", name: "群随机红包", price: 666, tag: "群红包", desc: "拼手气红包，钱会被一群人瞬间瓜分。", status: "群红包已发出", redPacket: true },
    { id: "merchant-code-fee", name: "商家收款码物料费", price: 58, tag: "商家", desc: "开通商家收款码、到账语音和提现服务。", status: "商家收款码已开通" },
    { id: "wallet-withdraw-fee", name: "零钱提现手续费", price: 3, tag: "提现", desc: "提现本身不是消费，但手续费会真实扣掉。", status: "提现手续费已扣" },
    { id: "family-card", name: "亲情卡本月账单", price: 520, tag: "亲情卡", desc: "家人消费后由你代扣，限额用完还会提醒提额。", status: "亲情卡账单已支付" },
    { id: "payment-code-verify", name: "付款码大额验证费", price: 5, tag: "风控", desc: "大额付款前的人脸核验、短信验证和风控服务。", status: "验证费已扣" },
    { id: "voice-speaker", name: "收款到账语音盒", price: 88, tag: "商家", desc: "蓝牙收款音箱、到账提醒和流量卡首月。", status: "语音盒已发货" },
    { id: "auto-debit-auth", name: "自动扣费授权首期", price: 30, tag: "授权", desc: "授权停车、会员或设备按月免密扣款。", status: "免密扣款已授权", asset: "subscription" },
  ],
  food: [
    { id: "noodle", name: "牛肉面套餐", price: 38, tag: "外卖", desc: "含打包费、配送费和平台服务费。", status: "骑手已接单" },
    { id: "hotpot", name: "双人火锅外送", price: 168, tag: "聚餐", desc: "锅底、菜品、蘸料和一次性餐具全算进去。", status: "商家备餐中" },
    { id: "grocery", name: "一周生鲜买菜", price: 236, tag: "买菜", desc: "蔬菜、鸡蛋、牛奶、水果，冷链配送。", status: "冷链配送中" },
    { id: "medicine-run", name: "跑腿买药", price: 79, tag: "跑腿", desc: "药品、跑腿费和夜间加价。", status: "跑腿员已出发" },
    { id: "food-vip", name: "外卖月卡", price: 25, tag: "会员", desc: "本月配送券包，买完马上想继续点。", status: "会员已生效" },
    { id: "pickup-tea", name: "奶茶到店自取", price: 24, tag: "自取", desc: "小程序下单，门店出杯后短信提醒。", status: "取餐码已生成" },
    { id: "dine-coupon", name: "到店团购套餐", price: 118, tag: "团购", desc: "双人套餐券，节假日不可用还要提前预约。", status: "团购券已入账" },
    { id: "table-hold", name: "餐厅排队订座押金", price: 60, tag: "订座", desc: "锁定桌位和排号，超时未到会扣部分押金。", status: "订座押金已冻结", hold: true, refundRate: 0.7 },
    { id: "supermarket-now", name: "超市小时达", price: 156, tag: "即时零售", desc: "熟食、饮料、清洁用品和即时配送费。", status: "拣货员正在配货" },
  ],
  shop: [
    { id: "phone", name: "旗舰手机", price: 6999, tag: "数码", desc: "官方标配版，支持七天无理由。", status: "仓库已出库" },
    { id: "laptop", name: "轻薄笔记本", price: 8999, tag: "办公", desc: "16GB 内存、1TB 硬盘，电子发票已开。", status: "顺丰已揽收" },
    { id: "air", name: "空气净化器", price: 1299, tag: "家电", desc: "含首年滤芯和上门安装。", status: "等待师傅预约" },
    { id: "sofa", name: "三人位沙发", price: 3299, tag: "家具", desc: "大件物流送装一体，需要预约电梯。", status: "干线运输中" },
    { id: "daily", name: "日用品囤货箱", price: 268, tag: "日用", desc: "纸巾、洗衣液、牙膏和垃圾袋。", status: "次日达配送中" },
    { id: "watch", name: "智能手表", price: 2499, tag: "穿戴", desc: "含蜂窝版开通服务费。", status: "已打包" },
    { id: "fashion-cart", name: "服饰鞋包购物车", price: 1288, tag: "服饰", desc: "尺码险、运费险、优惠券叠加后仍然很贵。", status: "商家已接单" },
    { id: "beauty-cart", name: "美妆个护囤货", price: 846, tag: "美妆", desc: "精华、面膜、防晒和平台百亿补贴服务费。", status: "保税仓已出库" },
    { id: "appliance-warranty", name: "家电延保三年", price: 399, tag: "延保", desc: "延长保修、上门检测和维修免人工费。", status: "延保服务已绑定", asset: "policy" },
    { id: "shop-plus", name: "电商省钱会员年卡", price: 198, tag: "会员", desc: "运费券、百补券、专属客服和自动续费提醒。", status: "会员已开通", asset: "subscription" },
  ],
  travel: [
    { id: "train", name: "高铁二等座", price: 553, tag: "火车票", desc: "上海虹桥到北京南，含出票服务。", status: "车票已出票" },
    { id: "flight", name: "经济舱机票", price: 1280, tag: "机票", desc: "含机建燃油和一份航延险。", status: "航班已确认" },
    { id: "hotel", name: "商务酒店两晚", price: 960, tag: "酒店", desc: "大床房两晚，支持到店押金。", status: "酒店已确认" },
    { id: "resort", name: "海岛度假套餐", price: 12800, tag: "度假", desc: "机酒、接送、浮潜和旅行保险。", status: "行程顾问已确认" },
    { id: "ticket", name: "景区门票", price: 180, tag: "门票", desc: "实名预约，入园刷身份证。", status: "电子票已生成" },
    { id: "car-rent", name: "两日租车", price: 688, tag: "租车", desc: "含基础保险和异地还车手续费。", status: "取车单已生成" },
    { id: "hotel-hold", name: "酒店到店押金", price: 800, tag: "预授权", desc: "入住前冻结押金，离店查房后释放。", status: "酒店押金已冻结", hold: true },
    { id: "visa-service", name: "签证材料服务", price: 560, tag: "签证", desc: "材料审核、照片、翻译和预约服务费。", status: "签证服务已受理" },
    { id: "flight-change", name: "机票改签差价", price: 420, tag: "改签", desc: "改签费、舱位差价和航司处理费。", status: "改签申请已提交" },
    { id: "baggage", name: "额外行李额", price: 260, tag: "行李", desc: "托运行李额、柜台差价和航司短信确认。", status: "行李额已购买" },
    { id: "airport-lounge", name: "机场贵宾厅", price: 168, tag: "权益", desc: "休息室、简餐、登机提醒和儿童附加费。", status: "贵宾厅券码已生成" },
    { id: "wifi-hold", name: "出境 Wi-Fi 押金", price: 500, tag: "押金", desc: "设备租赁押金，归还后扣除损耗再退。", status: "Wi-Fi 押金已冻结", hold: true, refundRate: 0.9 },
  ],
  cars: [
    { id: "fuel", name: "加油/充电", price: 320, tag: "用车", desc: "一次满油或快充账单。", status: "能源账单已支付" },
    { id: "parking", name: "月租停车位", price: 650, tag: "停车", desc: "小区地下车位一个月。", status: "车位已续费" },
    { id: "maintenance", name: "小保养套餐", price: 899, tag: "保养", desc: "机油机滤、工时费和检测报告。", status: "保养预约成功" },
    { id: "insurance", name: "交强险+商业险", price: 4680, tag: "保险", desc: "车损、三者和不计免赔。", status: "保单已出" },
    { id: "used-car", name: "二手燃油车全款", price: 58600, tag: "买车", desc: "含过户服务费和临牌。", status: "车辆已过户", asset: "vehicle" },
    { id: "ev-suv", name: "新能源 SUV 首付", price: 49900, tag: "首付", desc: "首付支付成功后生成汽车金融月供。", status: "订车合同已生成", asset: "vehicle", loan: { principal: 180000, months: 36, monthly: 5480, lender: "汽车金融", collateral: "新能源 SUV" } },
    { id: "test-drive-hold", name: "试驾保证金", price: 2000, tag: "保证金", desc: "预约高端车试驾，先冻结保证金。", status: "试驾保证金已冻结", hold: true },
    { id: "plate-auction", name: "车牌竞价保证金", price: 5000, tag: "车牌", desc: "参与车牌竞价前先缴保证金。", status: "竞价保证金已冻结", hold: true },
    { id: "car-wash", name: "精洗美容套餐", price: 238, tag: "洗车", desc: "精洗、打蜡、内饰清洁和门店预约服务费。", status: "洗车券已发放" },
    { id: "inspection", name: "车辆年检代办", price: 360, tag: "年检", desc: "检测站预约、代办跑腿和电子检验标志。", status: "年检代办已受理" },
    { id: "rescue-club", name: "道路救援年卡", price: 299, tag: "救援", desc: "拖车、搭电、换胎和高速服务限制。", status: "救援会员已开通", asset: "subscription" },
    { id: "violation-pay", name: "违章罚款代缴", price: 250, tag: "罚款", desc: "罚款、处理服务费和驾驶证短信提醒。", status: "违章处理已提交" },
  ],
  property: [
    { id: "rent", name: "整租月租", price: 2300, tag: "租房", desc: "当月房租，合同内固定扣款。", status: "房租已支付" },
    { id: "deposit", name: "押一付三", price: 9200, tag: "租房", desc: "押金一月、预付三月，生成租约记录。", status: "租约已生效", asset: "property" },
    { id: "mortgage", name: "住房按揭月供", price: 6800, tag: "房贷", desc: "本金、利息和账户管理费。", status: "本期月供已还" },
    { id: "down-payment", name: "商品房首付", price: 280000, tag: "买房", desc: "购房合同首付款，金额很真实，后续生成按揭月供。", status: "网签待确认", asset: "property", loan: { principal: 840000, months: 360, monthly: 4680, lender: "住房按揭", collateral: "商品房" } },
    { id: "decoration", name: "基础装修首期", price: 18800, tag: "装修", desc: "设计费、拆改费和首批材料款。", status: "装修已排期" },
    { id: "parking-space", name: "产权车位定金", price: 20000, tag: "车位", desc: "车位定金，后续还要补尾款。", status: "车位已锁定", asset: "property" },
    { id: "agency-fee", name: "租房中介费", price: 2300, tag: "中介", desc: "看房、签约和平台服务费，通常不退。", status: "中介费已支付" },
    { id: "viewing-hold", name: "购房认筹金", price: 50000, tag: "认筹", desc: "锁定选房资格，摇号失败才可能退。", status: "认筹金已冻结", hold: true },
    { id: "rent-hold", name: "看房锁房定金", price: 1000, tag: "定金", desc: "租房前锁定房源，违约可能扣一半。", status: "锁房定金已冻结", hold: true, refundRate: 0.5 },
    { id: "property-repair-fund", name: "公共维修资金", price: 8600, tag: "维修基金", desc: "购房配套缴费，按面积和当地规则计算。", status: "维修资金已缴" },
    { id: "moving-elevator", name: "搬家电梯占用费", price: 300, tag: "搬家", desc: "物业临时占梯、保护垫和押金管理费。", status: "占梯申请已提交" },
    { id: "home-policy", name: "房屋居住保障", price: 468, tag: "保障", desc: "租客责任、漏水、门锁和紧急维修保障。", status: "居住保障已生效" },
  ],
  services: [
    { id: "electricity", name: "电费缴纳", price: 186, tag: "生活", desc: "家庭用电账单，缴后立即销账。", status: "电费已缴" },
    { id: "water-gas", name: "水费+燃气费", price: 143, tag: "生活", desc: "两张账单合并支付。", status: "账单已结清" },
    { id: "hospital", name: "医院挂号", price: 75, tag: "医疗", desc: "专家门诊挂号费和平台服务费。", status: "号源已锁定" },
    { id: "course", name: "线上课程", price: 799, tag: "教育", desc: "年度课程包，支持反复观看。", status: "课程已开通" },
    { id: "cloud", name: "云盘年费", price: 198, tag: "订阅", desc: "2TB 存储空间续费一年。", status: "会员已续期" },
    { id: "donation", name: "公益捐款", price: 100, tag: "公益", desc: "生成捐赠记录和电子票据。", status: "捐赠已完成" },
    { id: "property-management", name: "小区物业费", price: 980, tag: "物业", desc: "物业、垃圾清运和公共能耗费用。", status: "物业费已缴" },
    { id: "heating", name: "集中供暖费", price: 1680, tag: "供暖", desc: "按建筑面积缴纳，跨季账单一次扣。", status: "供暖费已缴" },
    { id: "broadband-tv", name: "宽带电视账单", price: 156, tag: "宽带", desc: "宽带、IPTV、光猫租赁和维护费。", status: "宽带电视已缴费" },
    { id: "campus-card", name: "校园卡充值", price: 300, tag: "校园", desc: "食堂、澡堂、门禁和水控余额充值。", status: "校园卡已充值" },
    { id: "trash-fee", name: "垃圾处理费", price: 72, tag: "市政", desc: "社区垃圾处理、短信通知和电子票据。", status: "市政账单已结清" },
    { id: "network-install", name: "家庭网络安装", price: 260, tag: "安装", desc: "上门布线、路由器调试和弱电箱整理。", status: "师傅已预约" },
  ],
  entertainment: [
    { id: "movie", name: "双人电影票", price: 96, tag: "电影", desc: "含服务费，不含爆米花。", status: "取票码已生成" },
    { id: "concert", name: "演唱会看台票", price: 880, tag: "演出", desc: "实名票，禁止转赠。", status: "电子票已出票" },
    { id: "game", name: "游戏充值 648", price: 648, tag: "游戏", desc: "到账很快，后悔也很快。", status: "点券已到账" },
    { id: "fitness", name: "健身月卡", price: 299, tag: "运动", desc: "含团课预约和储物柜。", status: "会员已开卡" },
    { id: "streaming", name: "影视会员年卡", price: 258, tag: "会员", desc: "多端登录，部分内容还要单片付费。", status: "年卡已生效" },
    { id: "escape-room", name: "密室拼场", price: 198, tag: "线下", desc: "场次预约、服装道具、加时费和保险提示。", status: "场次已锁定" },
    { id: "karaoke", name: "KTV 包厢预订", price: 388, tag: "聚会", desc: "房费、茶位、服务费和到店押金说明。", status: "包厢已预订" },
    { id: "esports", name: "电竞赛事观赛票", price: 268, tag: "赛事", desc: "实名票、座位、应援包和取票码。", status: "赛事票已出票" },
    { id: "single-movie", name: "单片付费点播", price: 18, tag: "点播", desc: "48 小时观看权，不能下载不能退款。", status: "点播权限已开通" },
  ],
  stocks: [
    { id: "index-fund", name: "沪深300指数基金", price: 1000, tag: "基金", desc: "T+1 确认份额，净值每天更新。", status: "申购已提交", asset: "holding" },
    { id: "tech-stock", name: "科技股一手", price: 5200, tag: "股票", desc: "模拟买入 100 股，风险自担。", status: "委托已成交", asset: "holding" },
    { id: "gold", name: "黄金积存", price: 1500, tag: "黄金", desc: "按实时金价折算克数。", status: "黄金份额已确认", asset: "holding" },
    { id: "crypto", name: "虚拟币定投", price: 888, tag: "高风险", desc: "波动很大，手机提示也很吓人。", status: "买入已成交", asset: "holding" },
    { id: "deposit", name: "三月定期理财", price: 5000, tag: "理财", desc: "锁定期三个月，到期前不能取出。", status: "理财已持有", asset: "holding" },
  ],
  credit: [
    { id: "bnpl-daily", name: "先用后付日用品", price: 388, tag: "先用后付", desc: "本月先拿货，下月统一还信用账单。", status: "已入下月账单" },
    { id: "phone-installment", name: "旗舰手机 12 期", price: 6999, tag: "分期", desc: "本金、分期手续费、每月还款提醒一次生成。", status: "12 期分期已生成", months: 12 },
    { id: "course-installment", name: "职业课程分期", price: 12800, tag: "教育分期", desc: "首期入账，剩余金额分期偿还。", status: "教育分期已放款", months: 24 },
    { id: "virtual-card", name: "虚拟信用卡年费", price: 198, tag: "年费", desc: "开通海外支付虚拟卡，年费立即入账。", status: "虚拟卡已开通" },
    { id: "cash-service", name: "取现服务费", price: 80, tag: "取现", desc: "只是手续费，本金另算，真实世界也很疼。", status: "服务费已入账" },
  ],
  ride: [
    { id: "taxi", name: "实时打车", price: 47, tag: "网约车", desc: "起步价、里程费、时长费和平台服务费。", status: "司机已接单" },
    { id: "premium-car", name: "专车接送", price: 186, tag: "专车", desc: "商务车型、等待费和高速费预估。", status: "专车已派单" },
    { id: "airport", name: "机场接送", price: 268, tag: "接送机", desc: "含举牌服务、停车费和夜间补贴。", status: "接机单已确认" },
    { id: "chauffeur", name: "酒后代驾", price: 139, tag: "代驾", desc: "基础里程、等待费和保险服务费。", status: "代驾已出发" },
    { id: "bike-pass", name: "共享单车月卡", price: 25, tag: "骑行", desc: "30 天骑行卡，超时仍会扣费。", status: "骑行卡已生效", asset: "subscription" },
    { id: "etc", name: "ETC 充值", price: 500, tag: "高速", desc: "预存高速通行费，通行后逐笔扣减。", status: "ETC 已充值" },
    { id: "traffic-card", name: "交通卡充值", price: 100, tag: "公交", desc: "地铁公交交通卡在线充值。", status: "充值待写卡" },
  ],
  local: [
    { id: "cleaning", name: "三小时家庭保洁", price: 169, tag: "保洁", desc: "基础清洁、工具费和平台保障。", status: "阿姨已预约" },
    { id: "moving", name: "小型搬家", price: 699, tag: "搬家", desc: "起步价、楼层费、纸箱和大件搬运费。", status: "搬家师傅已接单" },
    { id: "repair", name: "家电上门维修", price: 260, tag: "维修", desc: "上门检测费、工时费和小配件。", status: "维修单已派工" },
    { id: "laundry", name: "洗衣取送", price: 88, tag: "洗衣", desc: "干洗两件，含取送服务费。", status: "骑手取件中" },
    { id: "haircut", name: "到店剪发", price: 128, tag: "门店", desc: "预约理发师、洗剪吹和平台预约费。", status: "门店已确认" },
    { id: "id-photo", name: "证件照精修", price: 39, tag: "证件照", desc: "拍摄、换底色、冲印和电子版。", status: "照片待下载" },
    { id: "storage", name: "迷你仓一个月", price: 360, tag: "仓储", desc: "1 立方米仓位、保险和取送费。", status: "仓位已锁定" },
  ],
  health: [
    { id: "consult", name: "图文问诊", price: 59, tag: "问诊", desc: "医生回复、平台服务费和电子病历。", status: "医生已接诊" },
    { id: "medicine", name: "处方药配送", price: 126, tag: "买药", desc: "药费、审方费、配送费和冷链包装。", status: "药师已审方" },
    { id: "checkup", name: "年度体检套餐", price: 899, tag: "体检", desc: "抽血、影像、报告解读和早餐。", status: "体检已预约" },
    { id: "dental", name: "洗牙抛光", price: 298, tag: "牙科", desc: "洁牙、抛光和一次性耗材费。", status: "牙科门诊已预约" },
    { id: "vaccine", name: "疫苗预约", price: 398, tag: "疫苗", desc: "疫苗费、接种服务费和留观提醒。", status: "接种号已锁定" },
    { id: "rehab", name: "康复理疗次卡", price: 520, tag: "康复", desc: "四次理疗、评估费和耗材费。", status: "次卡已开通" },
  ],
  insurance: [
    { id: "medical", name: "百万医疗险首月", price: 58, tag: "医疗险", desc: "首月保费，等待期和免赔额写在小字里。", status: "保单已承保", asset: "policy" },
    { id: "accident", name: "一年意外险", price: 168, tag: "意外险", desc: "意外医疗、身故伤残和救援服务。", status: "电子保单已生成", asset: "policy" },
    { id: "home", name: "家庭财产险", price: 299, tag: "财产险", desc: "房屋主体、室内财产、水管爆裂和盗抢。", status: "财产险已生效", asset: "policy" },
    { id: "screen", name: "手机碎屏险", price: 199, tag: "设备险", desc: "屏幕维修额度、免赔和服务网点。", status: "碎屏险已绑定", asset: "policy" },
    { id: "travel", name: "境内旅行险", price: 36, tag: "旅行险", desc: "意外、延误、行李和紧急救援。", status: "旅行险已出单", asset: "policy" },
    { id: "critical", name: "重疾险首期保费", price: 1200, tag: "重疾险", desc: "首期保费，后续每年都会提醒缴费。", status: "核保通过", asset: "policy" },
  ],
  subscriptions: [
    { id: "music", name: "音乐会员连续包月", price: 18, tag: "音乐", desc: "自动续费，取消入口藏得很深。", status: "音乐会员已开通", asset: "subscription" },
    { id: "office", name: "办公套件年费", price: 398, tag: "办公", desc: "文档、表格、协作和云同步。", status: "办公会员已生效", asset: "subscription" },
    { id: "cloud-drive", name: "云存储扩容", price: 288, tag: "云服务", desc: "4TB 空间，默认自动续费。", status: "云空间已扩容", asset: "subscription" },
    { id: "knowledge", name: "知识库会员", price: 198, tag: "内容", desc: "专栏、课程、电子书和会员徽章。", status: "知识会员已开通", asset: "subscription" },
    { id: "fitness-app", name: "运动 App 年卡", price: 328, tag: "运动", desc: "训练计划、数据分析和智能提醒。", status: "运动年卡已生效", asset: "subscription" },
    { id: "family", name: "家庭共享会员", price: 520, tag: "家庭", desc: "最多 6 人共享权益，账单只找你扣。", status: "家庭会员已创建", asset: "subscription" },
  ],
  logistics: [
    { id: "same-city", name: "同城闪送", price: 42, tag: "同城", desc: "小件急送、保价和夜间加价。", status: "骑手已取件" },
    { id: "express", name: "跨省快递", price: 28, tag: "寄件", desc: "首重、续重、包装袋和上门取件费。", status: "快递已揽收" },
    { id: "insured", name: "贵重物品保价", price: 86, tag: "保价", desc: "保价费、加固包装和签收确认。", status: "保价单已生成" },
    { id: "return", name: "退货运费", price: 18, tag: "退货", desc: "电商退货寄回，平台不一定报销。", status: "退货单已创建" },
    { id: "international", name: "国际小包", price: 236, tag: "国际", desc: "清关资料、燃油附加费和挂号费。", status: "国际件已出库" },
    { id: "locker", name: "快递柜超时费", price: 5, tag: "快递柜", desc: "超过免费保管时间后按天收费。", status: "超时费已缴" },
  ],
  secondhand: [
    { id: "used-phone", name: "二手手机验机购买", price: 2680, tag: "数码", desc: "平台验机、担保交易和运费险。", status: "担保订单已付款" },
    { id: "camera", name: "二手相机套机", price: 4200, tag: "摄影", desc: "机身、镜头、快门检测和保价快递。", status: "卖家待发货" },
    { id: "desk", name: "二手升降桌", price: 980, tag: "家具", desc: "同城自提、搬运费另算。", status: "交易已预约" },
    { id: "luxury", name: "中古包定金", price: 1500, tag: "奢侈品", desc: "平台鉴定费和定金，尾款另付。", status: "鉴定中" },
    { id: "auction", name: "拍卖保证金", price: 3000, tag: "保证金", desc: "参拍冻结保证金，成交后抵扣。", status: "保证金已冻结", hold: true },
    { id: "inspection", name: "上门验货服务", price: 168, tag: "验货", desc: "验货师、交通费和报告。", status: "验货师已预约" },
  ],
  gov: [
    { id: "traffic-fine", name: "交通违法罚款", price: 200, tag: "罚款", desc: "罚款、滞纳金提醒和处理服务。", status: "违法已处理" },
    { id: "passport", name: "出入境证件预约", price: 120, tag: "证照", desc: "证件工本费、照片回执和快递到付。", status: "预约已提交" },
    { id: "social-security", name: "社保补缴", price: 1320, tag: "社保", desc: "个人补缴、服务费和到账延迟。", status: "社保补缴已受理" },
    { id: "housing-fund", name: "公积金还贷提取手续费", price: 30, tag: "公积金", desc: "办理材料、短信通知和账户验证。", status: "申请已提交" },
    { id: "tax", name: "个税预缴", price: 880, tag: "税费", desc: "综合所得预缴，多退少补。", status: "税款已入库" },
    { id: "utility-deposit", name: "公共服务押金", price: 300, tag: "押金", desc: "临时场馆、设备借用和账户押金。", status: "押金已缴纳" },
  ],
  education: [
    { id: "tuition", name: "学期学费", price: 4200, tag: "学费", desc: "学校账单、平台通道费和电子票据。", status: "学费已缴" },
    { id: "exam", name: "考试报名费", price: 580, tag: "考试", desc: "报名费、考务费和短信通知。", status: "报名成功" },
    { id: "tutoring", name: "一对一家教包", price: 1200, tag: "家教", desc: "四次课、老师交通费和平台保障。", status: "家教已预约" },
    { id: "textbooks", name: "教材教辅套装", price: 266, tag: "教材", desc: "课本、练习册、快递和防伪查询。", status: "教材已发货" },
    { id: "certificate", name: "职业证书培训", price: 880, tag: "证书", desc: "课程、题库、证书工本费和电子档案。", status: "课程已开通", asset: "subscription" },
    { id: "childcare", name: "课后托管月费", price: 1600, tag: "托管", desc: "晚托、餐费、保险和接送通知。", status: "托管已开通" },
    { id: "study-abroad", name: "留学申请定金", price: 20000, tag: "留学", desc: "择校、文书、材料和顾问服务定金。", status: "顾问已建档" },
  ],
  beauty: [
    { id: "hair-dye", name: "剪发染烫套餐", price: 388, tag: "美发", desc: "预约发型师、材料费和门店服务费。", status: "门店已预约" },
    { id: "spa-card", name: "美容院储值卡", price: 1980, tag: "储值", desc: "储值后慢慢扣，退款规则写在小字里。", status: "储值卡已开通", asset: "subscription" },
    { id: "manicure", name: "美甲美睫套餐", price: 168, tag: "美甲", desc: "款式、卸甲、加固和预约费。", status: "美甲师已确认" },
    { id: "skincare", name: "护肤品套盒", price: 1280, tag: "护肤", desc: "精华、面霜、赠品和门店配送。", status: "套盒已出库" },
    { id: "massage", name: "肩颈按摩次卡", price: 298, tag: "按摩", desc: "三次体验、门店预约和耗材。", status: "次卡已生效" },
    { id: "portrait", name: "个人写真定金", price: 699, tag: "写真", desc: "拍摄、化妆、选片和精修定金。", status: "档期已锁定" },
    { id: "cosmetic-hold", name: "医美面诊保证金", price: 3000, tag: "医美", desc: "面诊和项目排期保证金，取消可能扣费。", status: "保证金已冻结", hold: true },
  ],
  pets: [
    { id: "pet-food", name: "宠物粮囤货", price: 329, tag: "口粮", desc: "主粮、罐头、冻干和运费险。", status: "宠物粮已发货" },
    { id: "grooming", name: "宠物洗护美容", price: 188, tag: "洗护", desc: "洗澡、修毛、剪指甲和接送费。", status: "洗护已预约" },
    { id: "vaccine", name: "宠物疫苗", price: 260, tag: "疫苗", desc: "疫苗、挂号、注射服务和留观。", status: "疫苗号已锁定" },
    { id: "vet", name: "宠物医院看诊", price: 620, tag: "看病", desc: "挂号、检查、处方药和耗材。", status: "诊疗单已支付" },
    { id: "boarding", name: "宠物寄养三天", price: 560, tag: "寄养", desc: "寄养、监控、基础保险和清洁费。", status: "寄养房已预留" },
    { id: "pet-insurance", name: "宠物医疗险", price: 399, tag: "保险", desc: "门诊、意外、等待期和免赔额。", status: "宠物保单已生成", asset: "policy" },
  ],
  recharge: [
    { id: "game-card", name: "游戏点卡", price: 328, tag: "游戏", desc: "充值到账后不可逆，未成年人会被提醒。", status: "点卡已到账" },
    { id: "live-tip", name: "直播打赏", price: 188, tag: "打赏", desc: "虚拟礼物、平台分成和粉丝牌。", status: "礼物已送出" },
    { id: "gift-card", name: "电子礼品卡", price: 500, tag: "礼品卡", desc: "购买后生成卡密，可转赠也可能被忘记。", status: "礼品卡已生成" },
    { id: "app-coin", name: "App 内购金币", price: 98, tag: "内购", desc: "金币包、手续费和到账通知。", status: "金币已到账" },
    { id: "ebook", name: "电子书买断", price: 68, tag: "内容", desc: "数字内容授权，不支持实体退货。", status: "电子书已入库" },
    { id: "ai-cloud", name: "AI 云服务额度", price: 128, tag: "云服务", desc: "模型调用、存储和自动续费提醒。", status: "额度已开通", asset: "subscription" },
    { id: "theme", name: "手机主题铃声", price: 18, tag: "主题", desc: "主题、字体、铃声和小组件。", status: "主题已下载" },
  ],
  social: [
    { id: "friend-red-packet", name: "好友红包", price: 200, tag: "红包", desc: "聊天窗口里发出的普通红包，发出后只能等对方收。", status: "红包已发送", redPacket: true },
    { id: "group-fee", name: "群活动 AA 缴费", price: 128, tag: "群收款", desc: "群管理员发起的聚餐、场地和物料 AA 收款。", status: "群收款已支付" },
    { id: "creator-tip", name: "创作者赞赏", price: 66, tag: "打赏", desc: "文章、视频或播客赞赏，平台会留下服务费。", status: "赞赏已送达" },
    { id: "dating-vip", name: "相亲会员月卡", price: 198, tag: "会员", desc: "查看访客、置顶曝光、实名认证和聊天权益。", status: "相亲会员已开通", asset: "subscription" },
    { id: "virtual-gift", name: "直播间虚拟礼物", price: 520, tag: "礼物", desc: "礼物特效、粉丝牌成长值和主播分成。", status: "礼物已送出" },
    { id: "paid-community", name: "付费社群年费", price: 399, tag: "社群", desc: "社群门票、资料库、直播回放和群管理服务。", status: "社群权益已开通", asset: "subscription" },
    { id: "identity-check", name: "社交实名认证", price: 30, tag: "认证", desc: "人脸核验、证件校验和身份标识。", status: "认证已提交" },
    { id: "wedding-gift", name: "电子礼金转账", price: 888, tag: "礼金", desc: "婚礼、乔迁或满月酒礼金，电子请柬里一键支付。", status: "礼金已送达" },
  ],
  rental: [
    { id: "camera-rent", name: "相机镜头三日租", price: 420, tag: "数码租赁", desc: "租金、损坏险、往返快递和平台服务费。", status: "租赁订单已生效" },
    { id: "camera-hold", name: "相机租赁押金", price: 3000, tag: "押金", desc: "高价值设备先冻结押金，归还验机后释放。", status: "租赁押金已冻结", hold: true, refundRate: 0.95 },
    { id: "suit-rent", name: "礼服租赁", price: 680, tag: "服装", desc: "礼服租金、清洗费、保险和超时费说明。", status: "礼服已预留" },
    { id: "tool-rent", name: "电钻工具箱周租", price: 168, tag: "工具", desc: "工具租金、耗材包和门店自提服务。", status: "工具已锁定" },
    { id: "mini-storage", name: "迷你仓季度租金", price: 1080, tag: "仓储", desc: "仓位租金、门禁卡押金、保险和管理费。", status: "迷你仓已开通", asset: "subscription" },
    { id: "battery-bank", name: "共享充电宝超时费", price: 24, tag: "共享设备", desc: "超时占用、异地归还和封顶计费。", status: "超时费已扣" },
    { id: "car-share-hold", name: "共享汽车预授权", price: 1500, tag: "预授权", desc: "租车前冻结押金，违章或剐蹭会延迟退回。", status: "共享汽车押金已冻结", hold: true, refundRate: 0.9 },
    { id: "device-subscribe", name: "办公电脑月租", price: 499, tag: "设备订阅", desc: "电脑租赁、远程运维、意外保障和到期换新。", status: "设备订阅已生效", asset: "subscription" },
  ],
  office: [
    { id: "cloud-server", name: "云服务器月费", price: 268, tag: "云计算", desc: "实例、带宽、快照、监控和公网 IP 费用。", status: "云服务器已续费", asset: "subscription" },
    { id: "domain", name: "域名注册年费", price: 89, tag: "域名", desc: "域名注册、隐私保护、DNS 解析和续费提醒。", status: "域名已注册", asset: "subscription" },
    { id: "saas-seat", name: "协作软件席位", price: 399, tag: "SaaS", desc: "团队成员席位、云文档、审批流和管理后台。", status: "席位已开通", asset: "subscription" },
    { id: "esign", name: "电子签章套餐", price: 120, tag: "签章", desc: "实名认证、合同签署、时间戳和证据链存证。", status: "签章包已购买" },
    { id: "meeting-room", name: "共享会议室半天", price: 360, tag: "会议室", desc: "会议室预订、投影、茶水和超时计费。", status: "会议室已预订" },
    { id: "print-batch", name: "文件打印装订", price: 86, tag: "打印", desc: "彩印、胶装、骑手取送和加急费。", status: "打印订单已提交" },
    { id: "invoice-service", name: "电子发票服务费", price: 25, tag: "发票", desc: "抬头校验、税号保存、发票归档和邮件发送。", status: "发票服务已开通" },
    { id: "coworking", name: "共享工位月卡", price: 980, tag: "工位", desc: "工位、门禁、咖啡、打印额度和会客权益。", status: "工位月卡已生效", asset: "subscription" },
  ],
  renovation: [
    { id: "design", name: "全屋设计定金", price: 2999, tag: "设计", desc: "量房、平面方案、效果图和预算清单。", status: "设计师已排期" },
    { id: "materials", name: "瓷砖地板订金", price: 12000, tag: "建材", desc: "主材定金、仓储、送货和损耗预估。", status: "建材订单已锁价" },
    { id: "appliance", name: "大家电套购", price: 28600, tag: "家电", desc: "冰洗空套装、延保、送装和旧机回收。", status: "家电已下单" },
    { id: "installation", name: "全屋安装尾款", price: 6800, tag: "安装", desc: "橱柜、灯具、卫浴、窗帘安装和垃圾清运。", status: "安装尾款已支付" },
    { id: "supervision", name: "装修监理服务", price: 3600, tag: "监理", desc: "节点验收、材料核验、陪签合同和问题整改。", status: "监理服务已开通" },
    { id: "furniture-final", name: "定制家具尾款", price: 18800, tag: "家具", desc: "柜体尾款、五金升级、上楼费和补件费。", status: "家具尾款已支付" },
    { id: "reno-loan", name: "装修贷首笔付款", price: 20000, tag: "装修贷", desc: "首笔工程款支付后生成装修贷款月供。", status: "装修贷合同已生成", loan: { principal: 120000, months: 60, monthly: 2450, lender: "消费金融", collateral: "装修合同" } },
    { id: "air-quality", name: "甲醛治理套餐", price: 2580, tag: "环保", desc: "检测、治理、复测和质保报告。", status: "治理服务已预约" },
  ],
  parenting: [
    { id: "formula", name: "奶粉尿裤月包", price: 899, tag: "消耗品", desc: "奶粉、尿裤、湿巾、辅食和次日达配送。", status: "母婴包已发货" },
    { id: "postpartum", name: "月嫂服务定金", price: 5000, tag: "月嫂", desc: "档期锁定、资质核验、保险和平台保障。", status: "月嫂档期已锁定", hold: true, refundRate: 0.8 },
    { id: "childcare", name: "托育月费", price: 3600, tag: "托育", desc: "托位、餐费、保险、监控和接送通知。", status: "托育已开通", asset: "subscription" },
    { id: "early-education", name: "早教课包", price: 6800, tag: "早教", desc: "课包、教材、测评、教具和调课手续费。", status: "早教课包已购买" },
    { id: "kids-vaccine", name: "儿童疫苗预约", price: 780, tag: "疫苗", desc: "疫苗费、接种服务、留观提醒和接种记录。", status: "疫苗号已锁定" },
    { id: "kids-insurance", name: "少儿医疗险首期", price: 668, tag: "保险", desc: "门急诊、住院、免赔额和等待期。", status: "少儿保单已生成", asset: "policy" },
    { id: "school-uniform", name: "校服与书包套装", price: 420, tag: "校园", desc: "校服、书包、姓名贴和配送费。", status: "校园用品已下单" },
    { id: "baby-photo", name: "周岁照定金", price: 999, tag: "摄影", desc: "拍摄档期、服装、化妆、选片和精修定金。", status: "拍摄档期已锁定" },
  ],
  tickets: [
    { id: "concert-vip", name: "演唱会内场票", price: 1680, tag: "演出", desc: "实名制门票、平台服务费和不可转赠提示。", status: "电子票已出票" },
    { id: "sports-final", name: "体育决赛门票", price: 980, tag: "体育", desc: "座位票、入场核验、保险和退改规则。", status: "赛事票已确认" },
    { id: "museum-pass", name: "展览联票", price: 168, tag: "展览", desc: "限时展、讲解器、预约码和入场时段。", status: "展览票已预约" },
    { id: "movie-premium", name: "IMAX 黄金场", price: 128, tag: "电影", desc: "电影票、服务费、卖品券和改签限制。", status: "取票码已生成" },
    { id: "ticket-speed", name: "抢票加速包", price: 88, tag: "抢票", desc: "候补优先、短信提醒、云排队和失败不全退。", status: "加速包已生效" },
    { id: "change-fee", name: "门票改签手续费", price: 60, tag: "改签", desc: "换场次、差价补缴和平台处理费。", status: "改签已提交" },
    { id: "paper-ticket", name: "纸质票快递", price: 35, tag: "快递", desc: "纸质纪念票、包装、快递和丢失风险。", status: "纸质票已寄出" },
    { id: "ticket-protect", name: "票务退票险", price: 45, tag: "保险", desc: "临时有事可赔付部分票款，条款写得很细。", status: "退票险已生效", asset: "policy" },
  ],
  overseas: [
    { id: "cross-border-shop", name: "跨境电商订单", price: 1280, tag: "海淘", desc: "商品、国际运费、关税预估和清关服务。", status: "清关资料已提交" },
    { id: "visa", name: "签证中心缴费", price: 720, tag: "签证", desc: "签证费、服务费、照片和快递。", status: "签证预约已确认" },
    { id: "forex", name: "外币兑换手续费", price: 80, tag: "外汇", desc: "购汇点差、跨境手续费和短信通知。", status: "手续费已扣" },
    { id: "intl-hotel-tax", name: "境外酒店城市税", price: 620, tag: "酒店税", desc: "到店税费、度假村费和信用卡预授权。", status: "酒店税费已预付" },
    { id: "wire", name: "跨境汇款", price: 1500, tag: "汇款", desc: "本金、汇款手续费、中转行费用和到账等待。", status: "汇款已提交" },
    { id: "esim", name: "境外 eSIM 流量", price: 119, tag: "eSIM", desc: "目的地流量包，扫码安装后不可退。", status: "eSIM 已签发" },
    { id: "duty-free-hold", name: "免税店预订定金", price: 3000, tag: "免税", desc: "锁定库存，到店提货时抵扣尾款。", status: "免税定金已冻结", hold: true },
  ],
  legal: [
    { id: "lawyer-call", name: "律师电话咨询", price: 199, tag: "咨询", desc: "30 分钟律师电话咨询，通话录音和咨询纪要同步生成。", status: "律师已接单" },
    { id: "contract-review", name: "合同审查", price: 580, tag: "合同", desc: "租房、劳动或采购合同审查，标出风险条款和修改建议。", status: "审查报告生成中" },
    { id: "notary", name: "线上公证预约", price: 320, tag: "公证", desc: "材料预审、公证费预缴、线下取证预约和快递服务。", status: "公证预约已提交" },
    { id: "lawsuit-filing", name: "法院诉讼费预缴", price: 980, tag: "诉讼", desc: "立案材料、诉讼费预缴、电子送达确认和案件号。", status: "立案缴费已提交" },
    { id: "arbitration-hold", name: "仲裁保证金", price: 5000, tag: "仲裁", desc: "仲裁受理前冻结保证金，撤案或败诉可能扣除部分费用。", status: "仲裁保证金已冻结", hold: true, refundRate: 0.4 },
    { id: "trademark", name: "商标注册服务", price: 1280, tag: "商标", desc: "检索、材料提交、官费、代理服务和驳回复审提醒。", status: "商标申请已提交", asset: "subscription" },
    { id: "labor-rights", name: "劳动仲裁材料包", price: 360, tag: "劳动", desc: "工资、离职、社保争议材料整理和证据清单。", status: "材料包已生成" },
    { id: "debt-demand", name: "欠款催收律师函", price: 680, tag: "催收", desc: "律师函、邮寄、公证送达和后续诉讼报价。", status: "律师函已寄出" },
  ],
  jobs: [
    { id: "resume-polish", name: "简历精修", price: 99, tag: "简历", desc: "简历排版、关键词优化、岗位匹配和 PDF 导出。", status: "简历精修中" },
    { id: "recruit-vip", name: "招聘会员月卡", price: 68, tag: "会员", desc: "职位曝光、主动沟通、已读提醒和自动续费。", status: "招聘会员已开通", asset: "subscription" },
    { id: "background-check", name: "求职背调报告", price: 128, tag: "背调", desc: "学历、证书、工商、司法和失信信息查询。", status: "背调报告生成中" },
    { id: "interview-coach", name: "面试辅导课", price: 399, tag: "辅导", desc: "模拟面试、岗位分析、薪资谈判和复盘文档。", status: "辅导老师已预约" },
    { id: "headhunter-hold", name: "高端猎头意向金", price: 3000, tag: "猎头", desc: "职位推荐意向金，入职失败按协议退还部分费用。", status: "猎头意向金已冻结", hold: true, refundRate: 0.75 },
    { id: "certificate-verify", name: "证书验证服务", price: 80, tag: "认证", desc: "职业证书、技能徽章和电子证明验证。", status: "认证结果待出" },
    { id: "relocation", name: "入职搬迁服务", price: 1500, tag: "搬迁", desc: "搬家、临住、行李寄送和落地办事服务。", status: "搬迁顾问已接单" },
    { id: "workplace-policy", name: "通勤意外险", price: 88, tag: "保险", desc: "上下班通勤意外、医疗补偿和电子保单。", status: "通勤保单已生成", asset: "policy" },
  ],
  events: [
    { id: "wedding-banquet-hold", name: "婚宴酒店定金", price: 20000, tag: "婚宴", desc: "档期锁定、桌数预留、服务费和取消扣款规则。", status: "婚宴定金已冻结", hold: true, refundRate: 0.7 },
    { id: "photo-video", name: "婚礼摄影摄像", price: 6800, tag: "摄影", desc: "双机位、跟拍、剪辑、修片和云相册交付。", status: "摄影团队已预约" },
    { id: "dress-rent", name: "婚纱礼服租赁", price: 3200, tag: "礼服", desc: "试纱、租金、清洗费、损坏险和押金说明。", status: "礼服档期已锁定" },
    { id: "venue-final", name: "宴会场地尾款", price: 58000, tag: "场地", desc: "场租、餐标、灯光、服务费和发票抬头。", status: "场地尾款已支付" },
    { id: "company-event", name: "公司团建活动", price: 12800, tag: "团建", desc: "场地、交通、餐饮、保险和主持服务。", status: "团建方案已确认" },
    { id: "birthday-party", name: "生日派对套餐", price: 1880, tag: "派对", desc: "布置、蛋糕、摄影、儿童安全和清洁费。", status: "派对套餐已预订" },
    { id: "conference-pass", name: "行业大会门票", price: 1680, tag: "会议", desc: "参会证、资料包、午餐、发票和改签规则。", status: "大会门票已出票" },
    { id: "event-policy", name: "活动取消险", price: 168, tag: "保险", desc: "天气、疾病、场地方违约等取消损失保障。", status: "活动保单已生成", asset: "policy" },
  ],
  security: [
    { id: "smart-lock", name: "智能门锁安装", price: 1280, tag: "门锁", desc: "门锁、上门安装、旧锁拆卸和三年质保。", status: "安装师傅已预约" },
    { id: "camera-cloud", name: "监控云存储年费", price: 198, tag: "监控", desc: "摄像头云录像、移动侦测、回看和自动续费。", status: "云存储已开通", asset: "subscription" },
    { id: "data-recovery", name: "手机数据恢复", price: 880, tag: "数据", desc: "相册、聊天记录、硬盘镜像和隐私协议。", status: "工程师已接单" },
    { id: "vpn-year", name: "隐私网络年费", price: 268, tag: "隐私", desc: "多设备加密通道、节点、审计报告和自动续费。", status: "隐私网络已开通", asset: "subscription" },
    { id: "password-family", name: "密码管家家庭版", price: 298, tag: "账号", desc: "密码库、家庭共享、泄露监测和紧急联系人。", status: "家庭密码库已创建", asset: "subscription" },
    { id: "lost-phone", name: "手机丢失定位服务", price: 68, tag: "找回", desc: "远程锁定、定位、擦除和运营商挂失指引。", status: "定位服务已启动" },
    { id: "home-alarm-hold", name: "家庭报警设备押金", price: 1000, tag: "押金", desc: "报警主机、门磁、安装预授权和退租验收。", status: "报警设备押金已冻结", hold: true, refundRate: 0.85 },
    { id: "privacy-report", name: "个人隐私风险报告", price: 88, tag: "报告", desc: "手机号泄露、黑产画像、App 授权和整改建议。", status: "隐私报告已生成" },
  ],
};

const defaultState = {
  activeApp: "home",
  installed: ["cash", "phone", "sms", "store"],
  cashBalance: 0,
  phoneNumber: "",
  carrierBalance: 0,
  phonePlan: {
    id: "",
    name: "",
    monthlyFee: 0,
    active: false,
    status: "未办理套餐",
    startedAt: "",
    paidMonthKey: "",
    expiredMonthKey: "",
  },
  gameTime: {
    year: 1,
    month: 1,
    day: 1,
    totalDays: 1,
  },
  cards: [],
  defaultCardId: "",
  clipboard: "",
  transferDraft: { cardNumber: "", amount: 100 },
  personTransferDraft: { contactId: "friend", amount: 200, note: "" },
  checkoutDraft: null,
  checkoutMethod: "card",
  spendFilters: {},
  foodDraft: {
    addressId: "home",
    deliveryMode: "standard",
    couponId: "platform-8",
    riderTip: 0,
    tableware: "need",
    privacyNumber: true,
    invoice: false,
    note: "",
  },
  shopDraft: {
    addressId: "home",
    shippingMode: "standard",
    couponId: "platform-50",
    freightInsurance: true,
    invoice: true,
    giftWrap: false,
    remark: "",
  },
  travelDraft: {
    passengerId: "self",
    dateSlot: "weekday",
    serviceLevel: "basic",
    baggage: "none",
    refundRule: "standard",
    couponId: "trip-40",
    insurance: true,
    invoice: true,
    autoCheckIn: true,
    remark: "",
  },
  shopCart: [],
  billRuns: [],
  profile: {
    address: "上海市浦东新区 MoneyOS 小区 8 号楼 1801",
    passenger: "张三 · 310101********1234",
    invoiceTitle: "个人电子发票",
    company: "口袋科技有限公司",
    licensePlate: "沪A·MO888",
    emergencyContact: "妈妈 13800006666",
  },
  dialNumber: "",
  smsDraft: { to: "", text: "" },
  calls: [],
  messages: [
    { id: "hello", from: "MoneyOS", to: "你", text: "欢迎使用。你现在连手机号都没有，但你可以先数钱。", time: "开机时" },
  ],
  transactions: [],
  orders: [],
  bookings: [],
  serviceRecords: [],
  shipments: [],
  lifeEvents: [],
  refunds: [],
  holds: [],
  subscriptions: [],
  loans: [],
  assets: {
    vehicles: [],
    properties: [],
    holdings: [],
    policies: [],
  },
  credit: {
    enabled: false,
    limit: 30000,
    used: 0,
    bills: [],
    installments: [],
  },
  installedAt: {},
  notifications: [],
  tutorial: {
    done: false,
    step: "openCash",
    callLogged: false,
  },
  stats: {
    countedBills: 0,
    lostTransfers: 0,
    bankTransfers: 0,
    downloads: 0,
    cardsOpened: 0,
    callsMade: 0,
    callsReceived: 0,
    smsSent: 0,
    moneySpent: 0,
    personTransfers: 0,
    personTransferAmount: 0,
    ordersPlaced: 0,
    travelBookings: 0,
    vehiclesBought: 0,
    propertiesPaid: 0,
    billsPaid: 0,
    investments: 0,
    ridesTaken: 0,
    localServices: 0,
    healthPayments: 0,
    insurancePolicies: 0,
    subscriptionPayments: 0,
    logisticsOrders: 0,
    secondhandOrders: 0,
    govPayments: 0,
    creditSpend: 0,
    creditLoans: 0,
    creditRepayments: 0,
    refunds: 0,
    refundAmount: 0,
    depositsFrozen: 0,
    depositRefunds: 0,
    subscriptionRenewals: 0,
    subscriptionCancels: 0,
    installmentRepayments: 0,
    educationPayments: 0,
    beautyOrders: 0,
    petPayments: 0,
    rechargePayments: 0,
    socialPayments: 0,
    rentalOrders: 0,
    officePayments: 0,
    renovationPayments: 0,
    parentingPayments: 0,
    ticketOrders: 0,
    overseasPayments: 0,
    legalPayments: 0,
    jobPayments: 0,
    eventPayments: 0,
    securityPayments: 0,
    appStorePurchases: 0,
    bankFees: 0,
    walletPayments: 0,
    redPackets: 0,
    communicationFees: 0,
    loanPrincipal: 0,
    loanRepayments: 0,
    recurringRuns: 0,
    recurringPaid: 0,
  },
};

let state = loadState();
let callTimer = 0;
let tutorialHangupTimer = 0;
let renderedAppId = state.activeApp || "home";
let moneyFeedbackTimer = 0;
let activeMoneyFeedback = null;
const scrollMemory = new Map();
const cashSwipe = {
  active: false,
  committed: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  startTime: 0,
  lastCommitAt: 0,
  startLow: false,
  dx: 0,
  dy: 0,
  maxUp: 0,
  moved: false,
};

const el = {
  phoneShell: document.querySelector(".phone-shell"),
  screen: document.querySelector("#screen"),
  phoneClock: document.querySelector("#phoneClock"),
  phoneSignal: document.querySelector("#phoneSignal"),
  phoneBattery: document.querySelector("#phoneBattery"),
  homeButton: document.querySelector("#homeButton"),
  backButton: document.querySelector("#backButton"),
  taskButton: document.querySelector("#taskButton"),
};

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return structuredClone(defaultState);
    const parsed = JSON.parse(stored);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      installed: Array.isArray(parsed.installed) ? parsed.installed : defaultState.installed,
      cards: Array.isArray(parsed.cards) ? parsed.cards : [],
      defaultCardId: typeof parsed.defaultCardId === "string" ? parsed.defaultCardId : "",
      phonePlan: { ...structuredClone(defaultState.phonePlan), ...(parsed.phonePlan || {}) },
      gameTime: { ...structuredClone(defaultState.gameTime), ...(parsed.gameTime || {}) },
      calls: Array.isArray(parsed.calls) ? parsed.calls.slice(0, 60) : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages.slice(0, 80) : defaultState.messages,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions.slice(0, 120) : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders.slice(0, 100) : [],
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings.slice(0, 60) : [],
      serviceRecords: Array.isArray(parsed.serviceRecords) ? parsed.serviceRecords.slice(0, 80) : [],
      shipments: Array.isArray(parsed.shipments) ? parsed.shipments.slice(0, 80) : [],
      lifeEvents: Array.isArray(parsed.lifeEvents) ? parsed.lifeEvents.slice(0, 80) : [],
      refunds: Array.isArray(parsed.refunds) ? parsed.refunds.slice(0, 60) : [],
      holds: Array.isArray(parsed.holds) ? parsed.holds.slice(0, 60) : [],
      subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions.slice(0, 60) : [],
      loans: Array.isArray(parsed.loans) ? parsed.loans.slice(0, 60) : [],
      assets: {
        vehicles: Array.isArray(parsed.assets?.vehicles) ? parsed.assets.vehicles.slice(0, 40) : [],
        properties: Array.isArray(parsed.assets?.properties) ? parsed.assets.properties.slice(0, 40) : [],
        holdings: Array.isArray(parsed.assets?.holdings) ? parsed.assets.holdings.slice(0, 60) : [],
        policies: Array.isArray(parsed.assets?.policies) ? parsed.assets.policies.slice(0, 60) : [],
      },
      credit: {
        ...structuredClone(defaultState.credit),
        ...(parsed.credit || {}),
        bills: Array.isArray(parsed.credit?.bills) ? parsed.credit.bills.slice(0, 80) : [],
        installments: Array.isArray(parsed.credit?.installments) ? parsed.credit.installments.slice(0, 60) : [],
      },
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications.slice(0, 40) : [],
      billRuns: Array.isArray(parsed.billRuns) ? parsed.billRuns.slice(0, 30) : [],
      tutorial: { ...defaultState.tutorial, ...(parsed.tutorial || {}) },
      stats: { ...defaultState.stats, ...parsed.stats },
      transferDraft: { ...defaultState.transferDraft, ...parsed.transferDraft },
      personTransferDraft: { ...defaultState.personTransferDraft, ...parsed.personTransferDraft },
      checkoutDraft: parsed.checkoutDraft?.category && parsed.checkoutDraft?.itemId ? parsed.checkoutDraft : null,
      checkoutMethod: parsed.checkoutMethod === "credit" ? "credit" : "card",
      spendFilters: { ...defaultState.spendFilters, ...(parsed.spendFilters || {}) },
      foodDraft: { ...defaultState.foodDraft, ...(parsed.foodDraft || {}) },
      shopDraft: { ...defaultState.shopDraft, ...(parsed.shopDraft || {}) },
      travelDraft: { ...defaultState.travelDraft, ...(parsed.travelDraft || {}) },
      shopCart: Array.isArray(parsed.shopCart) ? parsed.shopCart.slice(0, 24) : [],
      profile: { ...defaultState.profile, ...(parsed.profile || {}) },
      smsDraft: { ...defaultState.smsDraft, ...parsed.smsDraft },
      installedAt: parsed.installedAt || {},
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function scrollKeyFor(element, appId) {
  if (element.classList.contains("home-wallpaper")) return "home:body";
  if (element.classList.contains("checkout-scroll")) return `${appId}:checkout`;
  if (element.classList.contains("spend-filter")) return `${appId}:spend-filter:${element.getAttribute("aria-label") || ""}`;
  if (element.classList.contains("app-body")) return `${appId}:body`;
  return "";
}

function captureScrollPositions(appId = renderedAppId) {
  if (!el.screen) return;
  el.screen.querySelectorAll(".home-wallpaper, .app-body, .checkout-scroll, .spend-filter").forEach((element) => {
    const key = scrollKeyFor(element, appId);
    if (!key) return;
    scrollMemory.set(key, { left: element.scrollLeft, top: element.scrollTop });
  });
}

function restoreScrollPositions(appId = state.activeApp) {
  const restore = () => {
    el.screen.querySelectorAll(".home-wallpaper, .app-body, .checkout-scroll, .spend-filter").forEach((element) => {
      const saved = scrollMemory.get(scrollKeyFor(element, appId));
      if (!saved) return;
      element.scrollTop = Math.min(saved.top, Math.max(0, element.scrollHeight - element.clientHeight));
      element.scrollLeft = Math.min(saved.left, Math.max(0, element.scrollWidth - element.clientWidth));
    });
  };
  restore();
  window.requestAnimationFrame(restore);
}

function nowTime() {
  return new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function money(value) {
  return `¥${Math.floor(value).toLocaleString("zh-CN")}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function makeId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const categoryRealism = {
  store: { prefix: "APP", merchant: "MoneyOS 应用商店", checkout: "平台内购扣款，购买后写入应用商店账单。" },
  carrier: { prefix: "TEL", merchant: "MoneyOS 营业厅", checkout: "实名号码/通信服务，话费类到账后可继续通话发短信。" },
  bank: { prefix: "BNK", merchant: "XX银行电子渠道", checkout: "银行服务费即时扣款，部分项目会生成持仓或贷款材料。" },
  wallet: { prefix: "PAY", merchant: "钱包付款码", checkout: "扫码/转账实时扣款，交易完成后不能主动撤回。" },
  food: { prefix: "FOD", merchant: "附近商户联盟", checkout: "含打包、配送和平台服务费，预计 30-60 分钟送达。" },
  shop: { prefix: "SHP", merchant: "MoneyOS 自营/平台招商", checkout: "送至默认地址，支持售后但平台会扣服务费。" },
  travel: { prefix: "TRV", merchant: "MoneyOS 旅行", checkout: "实名出行订单，出票、入住或预约凭证同步短信。" },
  cars: { prefix: "CAR", merchant: "MoneyOS 汽车服务", checkout: "绑定车牌和车主资料，大额项目会生成资产或月供。" },
  property: { prefix: "HSE", merchant: "MoneyOS 房产", checkout: "合同、押金、首付和物业账单会进入房产记录。" },
  services: { prefix: "BIL", merchant: "城市生活缴费", checkout: "水电燃气和公共账单缴后销账，电子票据归档。" },
  entertainment: { prefix: "ENT", merchant: "MoneyOS 娱乐票务", checkout: "实名票/会员/点券支付，数字内容通常不可退。" },
  stocks: { prefix: "INV", merchant: "MoneyOS 证券", checkout: "申购或买入后形成持仓，估值会有波动。" },
  ride: { prefix: "RID", merchant: "MoneyOS 出行", checkout: "叫车、骑行或通行费实时扣款，行程结束后生成账单。" },
  local: { prefix: "LCL", merchant: "附近生活服务", checkout: "上门/到店服务，平台保障和预约时间写入订单。" },
  health: { prefix: "MED", merchant: "互联网医院", checkout: "实名医疗订单，问诊、处方和体检记录会留档。" },
  insurance: { prefix: "INS", merchant: "MoneyOS 保险经纪", checkout: "投保后生成电子保单，续保和理赔按条款执行。" },
  credit: { prefix: "CRD", merchant: "MoneyOS 信用", checkout: "先用后付进入信用账单，最终仍要从银行卡还款。" },
  subscriptions: { prefix: "SUB", merchant: "连续包月中心", checkout: "默认自动续费，可在订阅 App 中续费或取消。" },
  logistics: { prefix: "EXP", merchant: "MoneyOS 快递", checkout: "寄件、保价和退货运费按重量/距离计费。" },
  secondhand: { prefix: "2ND", merchant: "闲置担保交易", checkout: "平台担保、验货和保证金会同步交易记录。" },
  gov: { prefix: "GOV", merchant: "城市政务服务", checkout: "证照、罚款、税费和社保类缴费按实名资料办理。" },
  education: { prefix: "EDU", merchant: "教育缴费平台", checkout: "学费、考试和课程会生成电子票据或学习权益。" },
  beauty: { prefix: "BEA", merchant: "到店美业服务", checkout: "预约门店和技师，部分定金取消会扣费。" },
  pets: { prefix: "PET", merchant: "宠物生活平台", checkout: "宠物商品、医疗和寄养订单会留服务记录。" },
  recharge: { prefix: "DIG", merchant: "数字充值中心", checkout: "虚拟商品到账后通常不支持退款。" },
  social: { prefix: "SOC", merchant: "社交支付", checkout: "红包、礼物和付费社群发出后很难撤回。" },
  rental: { prefix: "RNT", merchant: "共享租赁平台", checkout: "租金和押金分开记录，归还验收后可退押金。" },
  office: { prefix: "BIZ", merchant: "企业办公服务", checkout: "办公 SaaS、云服务和发票服务按席位/周期计费。" },
  renovation: { prefix: "REN", merchant: "家装工程平台", checkout: "工程款、材料款和装修贷会生成阶段性账单。" },
  parenting: { prefix: "KID", merchant: "母婴家庭服务", checkout: "托育、早教、疫苗和儿童保障按实名资料办理。" },
  tickets: { prefix: "TIX", merchant: "MoneyOS 票务", checkout: "实名票、退改签和纸质票快递会生成票务订单。" },
  overseas: { prefix: "INT", merchant: "跨境支付服务", checkout: "含汇率、关税预估、签证或清关资料服务。" },
  legal: { prefix: "LAW", merchant: "法律服务平台", checkout: "律师、公证、诉讼和仲裁类费用按实名资料办理。" },
  jobs: { prefix: "JOB", merchant: "求职招聘平台", checkout: "简历、会员、背调和猎头服务会生成求职订单。" },
  events: { prefix: "EVT", merchant: "活动会务平台", checkout: "活动档期、场地、保险和尾款会进入活动账单。" },
  security: { prefix: "SEC", merchant: "家庭与数字安防", checkout: "设备、云存储、隐私服务和押金按地址/账号绑定。" },
  billhub: { prefix: "SUM", merchant: "账单中心", checkout: "固定支出批量扣款，所有明细仍会单独入账。" },
};

function currentProfile() {
  return { ...defaultState.profile, ...(state.profile || {}) };
}

function newOrderNumber(category) {
  const config = categoryRealism[category] || {};
  const prefix = config.prefix || String(category || "PAY").slice(0, 3).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function categoryProfileLine(category, item = {}) {
  const profile = currentProfile();
  if (category === "food" && item.foodBreakdown?.address) return `收货地址：${item.foodBreakdown.address.address}`;
  if (category === "shop" && item.shopBreakdown?.address) return `收货地址：${item.shopBreakdown.address.address}`;
  if (category === "travel" && item.travelBreakdown?.passenger) {
    const passenger = item.travelBreakdown.passenger;
    return `出行人：${passenger.name} · ${passenger.cert} · ${passenger.phone}`;
  }
  if (["shop", "food", "logistics", "recharge", "secondhand", "parenting", "pets"].includes(category)) return `收货地址：${profile.address}`;
  if (["travel", "tickets", "overseas", "health", "insurance", "education", "gov", "legal", "jobs"].includes(category)) return `实名信息：${profile.passenger}`;
  if (category === "cars" || category === "ride") return `车主/车牌：${profile.licensePlate}`;
  if (category === "property" || category === "renovation" || category === "security") return `房屋地址：${profile.address}`;
  if (category === "events") return `紧急联系人：${profile.emergencyContact}`;
  if (category === "office") return `企业抬头：${profile.company}`;
  if (category === "wallet" || item.redPacket) return "收款方确认后不可撤回";
  return `发票：${profile.invoiceTitle}`;
}

function makePaymentMeta(category, item, payment) {
  const config = categoryRealism[category] || {};
  const amount = Math.max(1, Math.floor(Number(payment.amount) || Number(item.price) || 0));
  const serviceFee = item.hold ? 0 : Math.max(0, Math.floor(amount * (category === "overseas" ? 0.018 : category === "stocks" ? 0.003 : 0.006)));
  const refundable = item.hold ? Math.max(1, Math.floor(amount * (item.refundRate || 1))) : 0;
  if (category === "food" && item.foodBreakdown) {
    const food = item.foodBreakdown;
    return {
      orderNo: newOrderNumber(category),
      merchant: food.merchant,
      channel: "MoneyOS 外卖",
      serviceFee: food.serviceFee,
      invoice: food.invoice ? currentProfile().invoiceTitle : "未申请发票",
      fulfillment: `${food.address.label} · ${food.address.address} · ${food.deliveryLabel} · ${food.eta}`,
      protection: `${config.checkout} ${food.privacyNumber ? "已启用隐私号。" : "使用真实手机号联系。"}${food.note ? ` 备注：${food.note}` : ""}`,
    };
  }
  if (category === "shop" && item.shopBreakdown) {
    const shop = item.shopBreakdown;
    return {
      orderNo: newOrderNumber(category),
      merchant: shop.merchant,
      channel: "MoneyOS 购物",
      serviceFee: shop.serviceFee,
      invoice: shop.invoice ? currentProfile().invoiceTitle : "未申请发票",
      fulfillment: `${shop.address.label} · ${shop.address.address} · ${shop.shippingLabel} · ${shop.eta}`,
      protection: `${config.checkout} ${shop.freightInsurance ? "已购买运费险。" : "未购买运费险。"}${shop.giftWrap ? " 已加礼品包装。" : ""}${shop.remark ? ` 备注：${shop.remark}` : ""}`,
    };
  }
  if (category === "travel" && item.travelBreakdown) {
    const travel = item.travelBreakdown;
    return {
      orderNo: newOrderNumber(category),
      merchant: travel.merchant,
      channel: "MoneyOS 旅行",
      serviceFee: travel.platformFee,
      invoice: travel.invoice ? currentProfile().invoiceTitle : "未申请发票",
      fulfillment: `${travel.dateSlot.label} · ${travel.route} · ${travel.fulfillmentLabel}`,
      protection: `${config.checkout} ${travel.returnRule} ${travel.insurance ? "已购出行保障。" : "未购出行保障。"}${travel.autoCheckIn ? " 已开启值机/入住助手。" : ""}${travel.remark ? ` 备注：${travel.remark}` : ""}`,
    };
  }
  const fulfillment = item.loan
    ? `${item.loan.lender || "贷款机构"}月供：${item.loan.months} 期，每期 ${money(item.loan.monthly)}`
    : item.hold
      ? `预授权冻结，可退 ${money(refundable)}`
      : categoryProfileLine(category, item);
  return {
    orderNo: newOrderNumber(category),
    merchant: config.merchant || apps[category]?.name || "MoneyOS 商户",
    channel: apps[category]?.name || "MoneyOS",
    serviceFee,
    invoice: currentProfile().invoiceTitle,
    fulfillment,
    protection: config.checkout || "已生成真实扣款记录。",
  };
}

function checkoutLineFor(category, item) {
  const config = categoryRealism[category] || {};
  const lines = [];
  if (category === "food" && item.foodBreakdown) {
    lines.push(`实付含${item.foodBreakdown.summary}`);
  }
  if (category === "shop" && item.shopBreakdown) {
    lines.push(`实付含${item.shopBreakdown.summary}`);
    lines.push(item.shopBreakdown.returnRule);
  }
  if (category === "travel" && item.travelBreakdown) {
    lines.push(`实付含${item.travelBreakdown.summary}`);
    lines.push(item.travelBreakdown.returnRule);
  }
  if (item.hold) lines.push(`押金/预授权，可退约 ${money(Math.floor(item.price * (item.refundRate || 1)))}`);
  if (item.loan) lines.push(`首付后生成 ${item.loan.months} 期月供，每期 ${money(item.loan.monthly)}`);
  if (item.asset === "subscription") lines.push("默认自动续费");
  if (item.asset === "policy") lines.push("生成电子保单");
  if (item.asset === "holding") lines.push("生成持仓估值");
  if (item.redPacket) lines.push("发出不可撤回");
  lines.push(config.checkout || categoryProfileLine(category, item));
  return lines.join(" · ");
}

function renderSpendFlags(item) {
  const flags = [];
  if (item.hold) flags.push("押金");
  if (item.loan) flags.push("月供");
  if (item.asset === "subscription") flags.push("续费");
  if (item.asset === "policy") flags.push("保单");
  if (item.asset === "holding") flags.push("持仓");
  if (item.redPacket) flags.push("不可撤回");
  if (!flags.length) return "";
  return `<div class="spend-flags">${flags.map((flag) => `<span>${flag}</span>`).join("")}</div>`;
}

function addNotice(text, extra = {}) {
  state.notifications.unshift({ id: makeId(), time: nowTime(), text, ...extra });
  state.notifications = state.notifications.slice(0, 40);
}

function addPhoneMessage(from, text) {
  state.messages.unshift({ id: makeId(), from, to: "我", text, time: nowTime() });
  state.messages = state.messages.slice(0, 80);
}

function triggerMoneyFeedback({ title, amount, channel, detail = "", balance = "", source = "MoneyOS", tone = "out" }) {
  const cleanAmount = Math.max(1, Math.floor(Number(amount) || 0));
  const feedback = {
    id: makeId(),
    title,
    amount: cleanAmount,
    channel,
    detail,
    balance,
    source,
    tone,
    time: nowTime(),
  };
  activeMoneyFeedback = feedback;

  addNotice(`${source}：${title} -${money(cleanAmount)}`, {
    kind: "money",
    amount: cleanAmount,
    channel,
    tone,
  });
  addPhoneMessage(source, `${title}支出 ${money(cleanAmount)}。${channel ? `渠道：${channel}。` : ""}${balance ? `${balance}。` : ""}${detail ? `备注：${detail}` : ""}`);

  if (window.navigator?.vibrate) window.navigator.vibrate(tone === "danger" ? [30, 35, 30, 35, 60] : [18, 28, 18]);
  if (el.phoneShell) {
    el.phoneShell.classList.remove("money-shock", "money-shock-danger");
    void el.phoneShell.offsetWidth;
    el.phoneShell.classList.add("money-shock");
    if (tone === "danger") el.phoneShell.classList.add("money-shock-danger");
  }

  window.clearTimeout(moneyFeedbackTimer);
  moneyFeedbackTimer = window.setTimeout(() => {
    activeMoneyFeedback = null;
    el.phoneShell?.classList.remove("money-shock", "money-shock-danger");
    render();
  }, 1800);
}

function hashText(value) {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

function mapNode(id) {
  return moneyCountryNodes.find((node) => node.id === id) || moneyCountryNodes[0];
}

function routeNodeNames(route) {
  return route.map((id) => mapNode(id).name).join(" → ");
}

function chooseOriginNode(category, item) {
  const candidates = moneyCountryNodes.filter((node) => node.id !== "shanghai" && node.id !== "cloudhub");
  const seed = `${category}:${item.id}:${item.name}:${item.tag}`;
  return candidates[hashText(seed) % candidates.length];
}

function buildShipmentRoute(originId, destinationId = "shanghai") {
  const origin = mapNode(originId);
  const destination = mapNode(destinationId);
  const route = [origin.id];
  if (origin.id !== "cloudhub") route.push("cloudhub");
  if (origin.x > 60 && !route.includes("rivercity")) route.push("rivercity");
  if (destination.id !== "cloudhub" && !route.includes(destination.id)) route.push(destination.id);
  return route.filter((id, index, list) => id && list.indexOf(id) === index);
}

function shipmentNumber(category) {
  return `MEX${String(hashText(`${category}-${Date.now()}-${Math.random()}`)).slice(0, 8)}`;
}

function pushShipmentEvent(shipment, text, kind = "move") {
  shipment.events = Array.isArray(shipment.events) ? shipment.events : [];
  shipment.events.unshift({ id: makeId(), day: gameDateText(), time: nowTime(), text, kind });
  shipment.events = shipment.events.slice(0, 12);
}

function createsShipment(category, item) {
  if (category === "shop") return item.asset !== "subscription" && item.asset !== "policy";
  if (category === "credit") return ["先用后付", "手机"].some((keyword) => `${item.name} ${item.tag} ${item.desc}`.includes(keyword));
  if (shippingCategories.has(category)) return true;
  const text = `${item.name} ${item.tag} ${item.desc} ${item.status}`;
  return shippingKeywords.some((keyword) => text.includes(keyword));
}

function createShipmentForRecord(record, category, item, payment) {
  if (!record || !createsShipment(category, item)) return null;
  const origin = chooseOriginNode(category, item);
  const destination = mapNode("shanghai");
  const route = buildShipmentRoute(origin.id, destination.id);
  const trackingNo = shipmentNumber(category);
  const shipment = {
    id: makeId(),
    recordId: record.id,
    category,
    title: item.name,
    amount: payment.amount,
    trackingNo,
    originId: origin.id,
    destinationId: destination.id,
    route,
    currentNodeIndex: 0,
    status: `${origin.name} 已生成电子面单`,
    detail: `${origin.kind}发货，目的地 ${destination.name}。路线：${routeNodeNames(route)}。`,
    createdDay: state.gameTime.totalDays,
    lastProcessedDay: state.gameTime.totalDays,
    stationReminders: 0,
    outForDelivery: false,
    stationNotified: false,
    signed: false,
    time: nowTime(),
    createdAt: Date.now(),
    events: [],
  };
  pushShipmentEvent(shipment, `${origin.name} 打印面单，包裹开始假装存在。`, "created");
  state.shipments.unshift(shipment);
  state.shipments = state.shipments.slice(0, 80);
  record.trackingNo = trackingNo;
  record.shipmentId = shipment.id;
  record.status = `${record.status || item.status || "订单已提交"} · ${shipment.status}`;
  addNotice(`MoneyOS快递：${item.name} 已从${origin.name}发货`, { kind: "logistics", shipmentId: shipment.id });
  addPhoneMessage("MoneyOS快递", `${item.name} 已发货，单号 ${trackingNo}。路线：${routeNodeNames(route)}。`);
  return shipment;
}

function courierCall(shipment, result = "快递签收电话") {
  state.calls.unshift({ id: makeId(), number: "快递员", type: "呼入", result, time: nowTime(), shipmentId: shipment.id });
  state.calls = state.calls.slice(0, 60);
  state.stats.callsReceived += 1;
}

function advanceShipmentOneDay(shipment) {
  if (shipment.signed) return;
  const route = Array.isArray(shipment.route) && shipment.route.length ? shipment.route : buildShipmentRoute(shipment.originId, shipment.destinationId);
  shipment.route = route;

  if (shipment.currentNodeIndex < route.length - 1) {
    shipment.currentNodeIndex += 1;
    const node = mapNode(route[shipment.currentNodeIndex]);
    shipment.status = `到达${node.name}${node.kind === "收货地" ? "本地分拣" : node.kind}`;
    pushShipmentEvent(shipment, `${shipment.title} 到达 ${node.name}，扫描员扫了一下又放回传送带。`);
    addNotice(`物流更新：${shipment.title} 到达${node.name}`, { kind: "logistics", shipmentId: shipment.id });
    addPhoneMessage("MoneyOS快递", `${shipment.title} 到达 ${node.name}。当前位置：${routeNodeNames(route.slice(0, shipment.currentNodeIndex + 1))}。`);
    return;
  }

  if (!shipment.outForDelivery) {
    shipment.outForDelivery = true;
    shipment.status = "快递员派送中";
    pushShipmentEvent(shipment, "快递员正在派送，电话准备响，但实物仍然处于哲学状态。", "call");
    courierCall(shipment, "快递员说马上到");
    addNotice(`快递员来电：${shipment.title} 正在派送`, { kind: "logistics", shipmentId: shipment.id });
    addPhoneMessage("快递员", `${shipment.title} 我马上到，你在家吗？不在也没事，我会放驿站。`);
    return;
  }

  if (!shipment.stationNotified) {
    shipment.stationNotified = true;
    shipment.status = "MoneyOS驿站待签收";
    pushShipmentEvent(shipment, "包裹已放入 MoneyOS 驿站，驿站 App 开始用力催你签收。", "station");
    addNotice(`MoneyOS驿站：${shipment.title} 待签收`, { kind: "logistics", shipmentId: shipment.id });
    addPhoneMessage("MoneyOS驿站", `${shipment.title} 已到站，取件码 ${String(hashText(shipment.id)).slice(0, 4)}。请在快递 App 里签收。`);
    return;
  }

  shipment.stationReminders = Math.floor(Number(shipment.stationReminders) || 0) + 1;
  shipment.status = `驿站催签收第 ${shipment.stationReminders} 次`;
  pushShipmentEvent(shipment, `驿站第 ${shipment.stationReminders} 次提醒：包裹还在，但你永远摸不到实物。`, "reminder");
  addNotice(`驿站催签收：${shipment.title}`, { kind: "logistics", shipmentId: shipment.id });
  addPhoneMessage("MoneyOS驿站", `${shipment.title} 还没签收。系统显示它离你 37 米，但这 37 米特别漫长。`);
  if (shipment.stationReminders % 2 === 0) courierCall(shipment, "快递员催你去驿站签收");
}

function processShipments() {
  state.shipments.forEach((shipment) => {
    if (shipment.signed) return;
    const lastDay = Math.max(0, Math.floor(Number(shipment.lastProcessedDay) || shipment.createdDay || 0));
    const days = Math.min(3, Math.max(0, state.gameTime.totalDays - lastDay));
    for (let i = 0; i < days; i += 1) advanceShipmentOneDay(shipment);
    shipment.lastProcessedDay = state.gameTime.totalDays;
  });
}

function scheduleLifeEvent({ category, source, title, text, delay = 1, call = false }) {
  state.lifeEvents.unshift({
    id: makeId(),
    category,
    source,
    title,
    text,
    dueDay: state.gameTime.totalDays + delay,
    call,
    done: false,
    createdAt: Date.now(),
  });
  state.lifeEvents = state.lifeEvents.slice(0, 80);
}

function scheduleSpendingAftercare(category, item) {
  if (createsShipment(category, item)) return;
  const source = apps[category]?.name || "MoneyOS";
  const templates = {
    food: ["骑手位置刷新", `${item.name} 仍显示还差 3 分钟，地图上的小车非常努力。`],
    stocks: ["持仓波动", `${item.name} 估值刷新，曲线假装自己有逻辑。`],
    travel: ["行程提醒", `${item.name} 已生成行程通知，请提前准备身份证和不存在的行李。`],
    insurance: ["保单回访", `${item.name} 电子保单已可查看，保障范围写得很认真。`],
    health: ["就诊提醒", `${item.name} 已提醒候诊，叫号屏幕在手机里闪了一下。`],
    beauty: ["预约确认", `${item.name} 门店已确认预约，客服让你准时到店。`],
    local: ["服务进度", `${item.name} 师傅已接单，正在路上绕一个很大的圈。`],
    services: ["缴费回执", `${item.name} 已生成缴费回执，系统建议你保存截图。`],
    subscriptions: ["订阅提醒", `${item.name} 已加入自动续费队列，下月还会想起你。`],
  };
  const [title, text] = templates[category] || ["订单后续", `${item.name} 状态已更新，手机世界继续为这笔钱运转。`];
  scheduleLifeEvent({ category, source, title, text, delay: 1, call: ["beauty", "local", "health"].includes(category) });
}

function processLifeEvents() {
  state.lifeEvents.forEach((event) => {
    if (event.done || state.gameTime.totalDays < event.dueDay) return;
    event.done = true;
    addNotice(`${event.source}：${event.title}`, { kind: "followup", category: event.category });
    addPhoneMessage(event.source, event.text);
    if (event.call) {
      state.calls.unshift({ id: makeId(), number: event.source, type: "呼入", result: event.title, time: nowTime() });
      state.calls = state.calls.slice(0, 60);
      state.stats.callsReceived += 1;
    }
  });
}

function processBackgroundLife() {
  processShipments();
  processLifeEvents();
}

function scheduleMoneyAftercare(source, title, text, { category = "money", delay = 1, call = false } = {}) {
  scheduleLifeEvent({ category, source, title, text, delay, call });
}

function signShipment(shipmentId) {
  const shipment = state.shipments.find((item) => item.id === shipmentId);
  if (!shipment) return;
  if (!shipment.stationNotified) {
    addNotice("驿站说：还没到站，先别急着签收。");
    render();
    return;
  }
  if (shipment.signed) {
    addNotice("这个包裹已经电子签收过了。");
    render();
    return;
  }

  shipment.signed = true;
  shipment.signedAt = gameDateText();
  shipment.status = "电子签收完成，实物仍未抵达";
  pushShipmentEvent(shipment, "你完成了电子签收，系统判定一切完美，现实里什么都没出现。", "signed");
  const record = [...state.orders, ...state.serviceRecords, ...state.bookings].find((item) => item.id === shipment.recordId);
  if (record) record.status = "已电子签收，实物永远在路上";
  addNotice(`MoneyOS驿站：${shipment.title} 已电子签收`, { kind: "logistics", shipmentId: shipment.id });
  addPhoneMessage("MoneyOS驿站", `${shipment.title} 已完成签收。感谢理解，物品将在精神层面送达。`);
  render();
}

function monthKey() {
  return `${state.gameTime.year}-${state.gameTime.month}`;
}

function gameDateText() {
  return `第${state.gameTime.year}年${state.gameTime.month}月${state.gameTime.day}日`;
}

function hasActivePlan() {
  return Boolean(state.phoneNumber && state.phonePlan?.active);
}

function carrierStatusLabel() {
  if (!state.phoneNumber) return "未办号";
  if (hasActivePlan()) return `${state.phonePlan.name} 生效中`;
  if (state.phonePlan?.id) return "欠费停机";
  return "未办套餐";
}

function canUseApp(appId) {
  return networkFreeApps.has(appId) || hasActivePlan();
}

function categoryRequiresNetwork(category) {
  return !["store", "carrier"].includes(category);
}

function blockReasonForApp(appId) {
  if (networkFreeApps.has(appId) || hasActivePlan()) return "";
  if (!state.phoneNumber) return "这台手机还没有电话卡。先去营业厅办号并办理套餐。";
  if (!state.phonePlan?.id) return "手机号还没办理套餐。办套餐后，软件才像软件。";
  return "套餐已到期，手机停机。先去营业厅续费。";
}

function monthRollover() {
  if (state.phoneNumber && state.phonePlan?.id) {
    state.phonePlan.active = false;
    state.phonePlan.status = "套餐到期，待手动续费";
    state.phonePlan.expiredMonthKey = monthKey();
    state.messages.unshift({
      id: makeId(),
      from: "营业厅",
      to: "我",
      text: `${state.phonePlan.name} 已进入新月份，请手动续费。欠费停机后，除了点钞、应用商店和营业厅，其他 App 都会假装不认识你。`,
      time: nowTime(),
    });
    state.messages = state.messages.slice(0, 80);
    addNotice("新月份到了：手机套餐已到期。");
    if (!canUseApp(state.activeApp)) state.activeApp = "carrier";
  }
}

function advanceGameDay(reason = "交易") {
  state.gameTime.totalDays = Math.max(1, Math.floor(Number(state.gameTime.totalDays) || 1)) + 1;
  state.gameTime.day = Math.max(1, Math.floor(Number(state.gameTime.day) || 1)) + 1;
  if (state.gameTime.day > MONTH_LENGTH) {
    state.gameTime.day = 1;
    state.gameTime.month = Math.max(1, Math.floor(Number(state.gameTime.month) || 1)) + 1;
    if (state.gameTime.month > 12) {
      state.gameTime.month = 1;
      state.gameTime.year = Math.max(1, Math.floor(Number(state.gameTime.year) || 1)) + 1;
    }
    monthRollover();
  }
  processBackgroundLife();
  addNotice(`${gameDateText()}：${reason}`);
}

function setApp(appId) {
  if (appId !== "home" && !state.installed.includes(appId)) {
    addNotice(`${apps[appId]?.name || "这个 App"}还没安装。`);
    state.activeApp = "store";
  } else if (appId !== "home" && !canUseApp(appId)) {
    addNotice(blockReasonForApp(appId));
    state.activeApp = state.installed.includes("carrier") ? "carrier" : "store";
  } else {
    state.activeApp = appId;
  }
  advanceTutorial(state.activeApp === "home" ? "home" : "open", state.activeApp);
  render();
}

function statusText() {
  if (!state.phoneNumber) return "无号码";
  if (!hasActivePlan()) return state.phonePlan?.id ? "欠费停机" : "未办套餐";
  return `${state.phoneNumber.slice(0, 3)} ${state.phoneNumber.slice(3, 7)} ${state.phoneNumber.slice(7)}`;
}

function randomPhoneNumber() {
  const prefixes = ["130", "131", "155", "166", "188", "199"];
  let rest = "";
  for (let i = 0; i < 8; i += 1) rest += Math.floor(Math.random() * 10);
  return prefixes[Math.floor(Math.random() * prefixes.length)] + rest;
}

function randomCardNumber() {
  const prefix = "6222";
  let body = "";
  for (let i = 0; i < 12; i += 1) body += Math.floor(Math.random() * 10);
  return prefix + body;
}

function formatCard(number) {
  return String(number).replace(/(.{4})/g, "$1 ").trim();
}

function cardByNumber(number) {
  const compact = String(number).replace(/\s/g, "");
  return state.cards.find((card) => card.number === compact);
}

function totalCardBalance() {
  return state.cards.reduce((sum, card) => sum + Math.max(0, Number(card.balance) || 0), 0);
}

function paymentCardFor(amount) {
  const defaultCard = state.cards.find((card) => card.id === state.defaultCardId);
  if (defaultCard && Number(defaultCard.balance) >= amount) return defaultCard;
  return state.cards.find((card) => Number(card.balance) >= amount) || state.cards[0] || null;
}

function recordTransaction(transaction) {
  state.transactions.unshift({
    id: makeId(),
    time: nowTime(),
    createdAt: Date.now(),
    ...transaction,
  });
  state.transactions = state.transactions.slice(0, 120);
}

function payFromCard(amount, title, category, detail = "", options = {}) {
  const cleanAmount = Math.max(1, Math.floor(Number(amount) || 0));
  if (!state.cards.length) {
    addNotice("支付失败：请先去 XX银行办理银行卡。");
    return null;
  }
  if (totalCardBalance() < cleanAmount) {
    addNotice(`支付失败：银行卡余额不足，还差 ${money(cleanAmount - totalCardBalance())}。`);
    return null;
  }

  const card = paymentCardFor(cleanAmount);
  if (!card || Number(card.balance) < cleanAmount) {
    addNotice("支付失败：没有单张银行卡余额足够。");
    return null;
  }

  card.balance -= cleanAmount;
  if (options.countSpending !== false) state.stats.moneySpent += cleanAmount;
  recordTransaction({
    direction: "out",
    title,
    category,
    amount: cleanAmount,
    cardName: card.name,
    cardNumber: card.number,
    detail,
  });
  if (options.advanceTime !== false) advanceGameDay(title);
  triggerMoneyFeedback({
    title,
    amount: cleanAmount,
    channel: `${card.name} 尾号${card.number.slice(-4)}`,
    detail: detail || category,
    balance: `银行卡余额 ${money(card.balance)}`,
    source: "XX银行",
  });
  return { card, amount: cleanAmount };
}

function creditAvailable() {
  return Math.max(0, Math.floor(Number(state.credit.limit) || 0) - Math.floor(Number(state.credit.used) || 0));
}

function recordCreditBill(entry) {
  state.credit.bills.unshift({
    id: makeId(),
    time: nowTime(),
    ...entry,
  });
  state.credit.bills = state.credit.bills.slice(0, 80);
}

function chargeCredit(amount, title, category, detail = "", extra = {}) {
  const cleanAmount = Math.max(1, Math.floor(Number(amount) || 0));
  if (!state.credit.enabled) {
    addNotice("信用支付失败：请先开通信用账户。");
    return null;
  }
  if (creditAvailable() < cleanAmount) {
    addNotice(`信用支付失败：可用额度不足，还差 ${money(cleanAmount - creditAvailable())}。`);
    return null;
  }

  state.credit.used += cleanAmount;
  state.stats.moneySpent += cleanAmount;
  state.stats.creditSpend += cleanAmount;
  recordTransaction({
    direction: "out",
    title,
    category,
    amount: cleanAmount,
    cardName: "信用账户",
    cardNumber: "credit",
    detail,
  });
  recordCreditBill({
    type: "spend",
    title,
    category,
    amount: cleanAmount,
    status: extra.status || "待还款",
    detail,
  });
  if (extra.advanceTime !== false) advanceGameDay(title);
  triggerMoneyFeedback({
    title,
    amount: cleanAmount,
    channel: "信用额度",
    detail: detail || category,
    balance: `待还 ${money(state.credit.used)}，可用 ${money(creditAvailable())}`,
    source: "信用中心",
  });
  return { credit: true, amount: cleanAmount };
}

function creditBlockReason(category, item = {}) {
  if (!state.credit.enabled) return "请先在信用 App 开通信用账户。";
  if (["bank", "stocks", "credit"].includes(category)) return "银行服务、投资和信用还款不能使用信用额度。";
  if (category === "property") return "房产首付、租金、认筹和房贷必须使用银行卡。";
  if (item.loan) return "贷款首付会生成长期月供，必须先用银行卡支付。";
  if (category === "wallet" && (item.redPacket || ["红包", "群红包", "AA", "提现"].includes(item.tag))) return "转账、红包、AA 和提现手续费不能使用信用额度。";
  if (category === "gov" && ["税费", "社保", "公积金", "罚款"].includes(item.tag)) return "政务税费、社保、公积金和罚款只支持银行卡。";
  if (category === "overseas" && item.id === "wire") return "跨境汇款本金必须从银行卡扣款。";
  if (category === "legal" && ["诉讼", "仲裁", "公证"].includes(item.tag)) return "诉讼费、仲裁保证金和公证费必须使用银行卡。";
  return "";
}

function checkoutMethodLabel() {
  return state.checkoutMethod === "credit" ? "信用额度" : "银行卡";
}

function payCatalogItem(category, item, categoryName) {
  if (state.checkoutMethod === "credit") {
    const reason = creditBlockReason(category, item);
    if (reason) {
      addNotice(`信用支付失败：${reason}`);
      return null;
    }
    return chargeCredit(item.price, item.name, categoryName, item.desc, { status: item.status });
  }
  return payFromCard(item.price, item.name, categoryName, item.desc);
}

function addOrder(category, item, payment, extra = {}) {
  const order = {
    id: makeId(),
    category,
    title: item.name,
    amount: payment.amount,
    status: item.status || "订单已提交",
    detail: item.desc,
    meta: payment.meta || makePaymentMeta(category, item, payment),
    time: nowTime(),
    createdAt: Date.now(),
    cardName: payment.card?.name || (payment.credit ? "信用账户" : ""),
    cardNumber: payment.card?.number || (payment.credit ? "credit" : ""),
    ...extra,
  };
  state.orders.unshift(order);
  state.orders = state.orders.slice(0, 100);
  state.stats.ordersPlaced += 1;
  return order;
}

function addServiceRecord(category, item, payment, extra = {}) {
  const record = {
    id: makeId(),
    category,
    title: item.name,
    amount: payment.amount,
    status: item.status || "已支付",
    detail: item.desc,
    meta: payment.meta || makePaymentMeta(category, item, payment),
    time: nowTime(),
    createdAt: Date.now(),
    cardName: payment.card?.name || (payment.credit ? "信用账户" : ""),
    cardNumber: payment.card?.number || (payment.credit ? "credit" : ""),
    ...extra,
  };
  state.serviceRecords.unshift(record);
  state.serviceRecords = state.serviceRecords.slice(0, 80);
  return record;
}

function addSubscription(item, payment, source) {
  state.subscriptions.unshift({
    id: makeId(),
    source,
    name: item.name,
    amount: payment.amount,
    status: item.status || "订阅已开通",
    cycle: item.tag || "自动续费",
    nextCharge: "下月同日",
    meta: payment.meta || makePaymentMeta(source, item, payment),
    time: nowTime(),
    createdAt: Date.now(),
  });
  state.subscriptions = state.subscriptions.slice(0, 60);
}

function addPolicy(item, payment) {
  state.assets.policies.unshift({
    id: makeId(),
    kind: item.tag,
    name: item.name,
    amount: payment.amount,
    detail: item.status,
    status: item.status,
    meta: payment.meta,
    time: nowTime(),
    createdAt: Date.now(),
  });
  state.assets.policies = state.assets.policies.slice(0, 60);
}

function addHolding(category, item, payment) {
  const currentValue = Math.max(1, Math.floor(payment.amount * (0.58 + Math.random() * 0.82)));
  const mood = currentValue >= payment.amount ? "账户看起来像在努力" : "账户正在表演下坠";
  state.assets.holdings.unshift({
    id: makeId(),
    category,
    kind: item.tag,
    name: item.name,
    amount: payment.amount,
    detail: `${item.status || "已持有"}，当前估值 ${money(currentValue)}，${mood}`,
    status: item.status || "已持有",
    value: currentValue,
    meta: payment.meta,
    time: nowTime(),
    createdAt: Date.now(),
  });
  state.assets.holdings = state.assets.holdings.slice(0, 60);
  state.stats.investments += payment.amount;
}

function addLoanContract(category, item, payment) {
  if (!item.loan) return;
  const principal = Math.max(1, Math.floor(Number(item.loan.principal) || 0));
  const months = Math.max(1, Math.floor(Number(item.loan.months) || 1));
  const monthly = Math.max(1, Math.floor(Number(item.loan.monthly) || Math.ceil(principal / months)));
  state.loans.unshift({
    id: makeId(),
    category,
    title: item.name,
    lender: item.loan.lender || apps[category]?.name || "贷款机构",
    collateral: item.loan.collateral || item.tag || "消费资产",
    principal,
    downPayment: payment.amount,
    monthly,
    months,
    remainingMonths: months,
    paidAmount: 0,
    status: "放款后待按期还款",
    meta: payment.meta || makePaymentMeta(category, item, payment),
    time: nowTime(),
    createdAt: Date.now(),
  });
  state.loans = state.loans.slice(0, 60);
  state.stats.loanPrincipal += principal;
  state.messages.unshift({
    id: makeId(),
    from: item.loan.lender || "贷款机构",
    to: "我",
    text: `${item.name} 已生成贷款合同，本金 ${money(principal)}，每期 ${money(monthly)}，共 ${months} 期。`,
    time: nowTime(),
  });
  state.messages = state.messages.slice(0, 80);
}

function addHold(category, item, payment) {
  state.holds.unshift({
    id: makeId(),
    category,
    title: item.name,
    amount: payment.amount,
    refundable: Math.max(1, Math.floor(payment.amount * (item.refundRate || 1))),
    status: item.status || "押金已冻结",
    detail: item.desc,
    meta: payment.meta || makePaymentMeta(category, item, payment),
    time: nowTime(),
    createdAt: Date.now(),
    cardName: payment.card?.name || (payment.credit ? "信用账户" : ""),
    cardNumber: payment.card?.number || (payment.credit ? "credit" : ""),
  });
  state.holds = state.holds.slice(0, 60);
  state.stats.depositsFrozen += payment.amount;
}

function appHeader(title, subtitle = "") {
  return `
    <header class="app-header">
      <button class="plain-button" data-home="true">‹</button>
      <div>
        <strong>${title}</strong>
        ${subtitle ? `<span>${subtitle}</span>` : ""}
      </div>
      <button class="plain-button" data-app="home">⌂</button>
    </header>
  `;
}

function render() {
  captureScrollPositions(renderedAppId);
  normalizeTutorialProgress();
  if (state.activeApp !== "home" && !canUseApp(state.activeApp)) state.activeApp = state.installed.includes("carrier") ? "carrier" : "store";
  const activeTutorial = tutorialActive();
  el.phoneClock.textContent = nowTime();
  el.phoneSignal.textContent = activeTutorial ? "☎ 神秘电话" : statusText();
  el.phoneBattery.textContent = `${82 + (state.stats.countedBills % 16)}%`;
  el.phoneShell.classList.toggle("tutorial-call-active", activeTutorial);
  el.screen.className = `phone-screen ${state.activeApp === "home" ? "home-screen" : "app-screen"} ${state.activeApp}-app`;

  const views = {
    home: renderHome,
    cash: renderCashApp,
    phone: renderPhoneApp,
    sms: renderSmsApp,
    store: renderStoreApp,
    carrier: renderCarrierApp,
    bank: renderBankApp,
    wallet: renderWalletApp,
    billhub: renderBillHubApp,
    food: renderFoodApp,
    shop: renderShopApp,
    travel: renderTravelApp,
    cars: renderCarsApp,
    property: renderPropertyApp,
    services: renderServicesApp,
    entertainment: renderEntertainmentApp,
    stocks: renderStocksApp,
    ride: renderRideApp,
    local: renderLocalApp,
    health: renderHealthApp,
    insurance: renderInsuranceApp,
    credit: renderCreditApp,
    subscriptions: renderSubscriptionsApp,
    logistics: renderLogisticsApp,
    secondhand: renderSecondhandApp,
    gov: renderGovApp,
    education: renderEducationApp,
    beauty: renderBeautyApp,
    pets: renderPetsApp,
    recharge: renderRechargeApp,
    social: renderSocialApp,
    rental: renderRentalApp,
    office: renderOfficeApp,
    renovation: renderRenovationApp,
    parenting: renderParentingApp,
    tickets: renderTicketsApp,
    overseas: renderOverseasApp,
    legal: renderLegalApp,
    jobs: renderJobsApp,
    events: renderEventsApp,
    security: renderSecurityApp,
  };

  el.screen.innerHTML = `${(views[state.activeApp] || renderHome)()}${renderCheckoutSheet()}${renderMoneyFeedback()}${renderTutorialOverlay()}`;
  renderedAppId = state.activeApp;
  restoreScrollPositions(renderedAppId);
  syncTutorialChrome();
  syncTutorialScroll();
  if (tutorialActive()) window.requestAnimationFrame(syncTutorialScroll);
  saveState();
}

function renderHome() {
  const installedApps = state.installed.map((id) => apps[id]).filter(Boolean);
  return `
    <section class="home-wallpaper">
      <div class="home-top">
        <strong>MoneyOS</strong>
        <span>${carrierStatusLabel()}</span>
      </div>
      <div class="time-strip">
        <strong>${gameDateText()}</strong>
        <span>${state.phoneNumber ? `${statusText()} · 话费 ${money(state.carrierBalance)}` : "还没电话卡，世界非常安静"}</span>
      </div>
      <div class="widget">
        <span>点钞余额</span>
        <strong>${money(state.cashBalance)}</strong>
        <small>只能转进银行卡，不能直接花。${state.cards.length ? `${state.cards.length} 张银行卡` : "还没有银行卡"}</small>
      </div>
      ${renderNotificationWidget()}
      <nav class="desktop-grid" aria-label="已安装 App">
        ${installedApps
          .map((app) => {
            const id = appIdByName(app.name);
            return `
              <button class="desktop-app ${tutorialTargetClass("open", id)}" data-open="${id}">
                <span style="--app-color:${app.color}">${app.icon}</span>
                <b>${app.name}</b>
              </button>
            `;
          })
          .join("")}
      </nav>
      <div class="dock">
        ${["phone", "sms", "cash", "store"]
          .filter((id) => state.installed.includes(id))
          .map((id) => `<button class="${tutorialTargetClass("open", id)}" data-open="${id}" style="--app-color:${apps[id].color}">${apps[id].icon}</button>`)
          .join("")}
      </div>
    </section>
  `;
}

function appIdByName(name) {
  return Object.keys(apps).find((id) => apps[id].name === name) || "home";
}

function renderNotificationWidget() {
  const latest = state.notifications.slice(0, 3);
  if (!latest.length) return "";
  return `
    <section class="notification-widget" aria-label="最近手机通知">
      <div>
        <span>最近通知</span>
        <strong>${latest[0].kind === "money" ? "刚刚有钱动了" : "手机有动静"}</strong>
      </div>
      ${latest
        .map(
          (notice) => `
            <article class="notification-row ${notice.kind === "money" ? "money-row" : ""}">
              <b>${notice.kind === "money" ? "¥" : "!"}</b>
              <p>${escapeHtml(notice.text)}<span>${escapeHtml(notice.time)}</span></p>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderMoneyFeedback() {
  if (!activeMoneyFeedback) return "";
  const feedback = activeMoneyFeedback;
  return `
    <aside class="money-feedback ${feedback.tone === "danger" ? "danger-feedback" : ""}" aria-live="assertive">
      <div class="feedback-icon">${feedback.tone === "danger" ? "!" : "¥"}</div>
      <div>
        <span>${escapeHtml(feedback.source)} · ${escapeHtml(feedback.time)}</span>
        <strong>-${money(feedback.amount)}</strong>
        <p>${escapeHtml(feedback.title)}</p>
        <small>${escapeHtml([feedback.channel, feedback.balance].filter(Boolean).join(" · "))}</small>
      </div>
    </aside>
  `;
}

function renderCashApp() {
  return `
    ${appHeader("点钞", "一张一张点，点多少就是多少")}
    <section class="cash-fullscreen">
      <div class="cash-total">
        <span>本 App 余额</span>
        <strong>${money(state.cashBalance)}</strong>
        <small>只有办了银行卡，才能把这里的钱转出去。</small>
      </div>
      <div class="cash-swipe-zone ${tutorialTargetClass("cashSwipe")}" data-cash-swipe="true" aria-label="从下往上划走一张钱">
        <div class="cash-stack-gesture" aria-hidden="true">
          <span class="cash-shadow"></span>
          <span class="cash-slot"></span>
          <span class="cash-layer layer-a"></span>
          <span class="cash-layer layer-b"></span>
          <span class="cash-layer layer-c"></span>
          <span class="swipe-cash-bill">
            <span class="bill-face">100</span>
          </span>
          <span class="thumb-pad"></span>
        </div>
      </div>
      <p class="hint">用大拇指从屏幕下方往上一划，划走一张才算数。点一下不会加钱。</p>
    </section>
  `;
}

function renderPhoneApp() {
  return `
    ${appHeader("电话", hasActivePlan() ? "可以拨号，也会有人打进来" : carrierStatusLabel())}
    <section class="app-body">
      ${hasActivePlan() ? "" : `<p class="warning">${blockReasonForApp("phone")}</p>`}
      <div class="dial-display">${state.dialNumber || "输入电话号码"}</div>
      <div class="dial-pad">
        ${["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]
          .map((key) => `<button data-dial="${key}">${key}</button>`)
          .join("")}
      </div>
      <div class="action-row">
        <button class="primary" data-call="true" ${hasActivePlan() ? "" : "disabled"}>拨打</button>
        <button data-clear-dial="true">清除</button>
      </div>
      <h3>通话记录</h3>
      ${renderCalls()}
    </section>
  `;
}

function renderSmsApp() {
  return `
    ${appHeader("短信", hasActivePlan() ? `本机 ${state.phoneNumber}` : carrierStatusLabel())}
    <section class="app-body">
      ${hasActivePlan() ? "" : `<p class="warning">${blockReasonForApp("sms")}</p>`}
      <div class="form-card">
        <label>收件人</label>
        <input data-sms-to value="${state.smsDraft.to}" placeholder="输入手机号" />
        <label>短信内容</label>
        <textarea data-sms-text placeholder="输入短信">${state.smsDraft.text}</textarea>
        <button class="primary" data-send-sms="true" ${hasActivePlan() ? "" : "disabled"}>发送短信</button>
      </div>
      <h3>短信</h3>
      ${renderMessages()}
    </section>
  `;
}

function renderStoreApp() {
  const downloadable = Object.entries(apps).filter(([, app]) => !app.builtin);
  return `
    ${appHeader("应用商店", "所有新软件都从这里下载")}
    <section class="app-body store-list">
      ${renderPaymentSummary()}
      <h3>下载 App</h3>
      ${downloadable
        .map(([id, app]) => {
          const installed = state.installed.includes(id);
          return `
            <article class="store-item">
              <span class="store-icon" style="--app-color:${app.color}">${app.icon}</span>
              <div>
                <strong>${app.name}</strong>
                <p>${app.desc}</p>
              </div>
              <button class="${tutorialTargetClass("download", id)}" data-download="${id}" ${installed ? "disabled" : ""}>${installed ? "已安装" : "下载"}</button>
            </article>
          `;
        })
        .join("")}
      <h3>付费下载与内购</h3>
      ${renderSpendList("store", "购买")}
      <h3>应用商店账单</h3>
      ${renderRecordList(recordsForAny("store"), "还没有应用商店购买记录。")}
    </section>
  `;
}

function renderCarrierApp() {
  return `
    ${appHeader("营业厅", state.phoneNumber ? carrierStatusLabel() : "先买一个手机号")}
    <section class="app-body">
      <div class="sim-card">
        <span>本机号码</span>
        <strong>${state.phoneNumber || "未办理"}</strong>
        <small>${state.phoneNumber ? `${carrierStatusLabel()} · 话费余额 ${money(state.carrierBalance)} · ${gameDateText()}` : `首次办号会自动从点钞余额扣 ${money(FIRST_NUMBER_TOP_UP)} 充话费`}</small>
      </div>
      <button class="primary ${tutorialTargetClass("buyNumber")}" data-buy-number="true" ${state.phoneNumber ? "disabled" : ""}>购买随机手机号 · 自动首充 ${money(FIRST_NUMBER_TOP_UP)}</button>
      <button data-recharge="true" ${state.phoneNumber && state.cards.length ? "" : "disabled"}>银行卡充 ¥50 话费</button>
      ${state.phoneNumber && !hasActivePlan() ? `<p class="warning">未办理套餐或套餐已到期：除了点钞、应用商店和营业厅，其他 App 都会停用。</p>` : ""}
      <h3>手机套餐</h3>
      <div class="plan-list carrier-plan-list">
        ${Object.values(carrierPlans)
          .map(
            (plan) => `
              <div>
                <strong>${plan.name}</strong>
                <span>${plan.desc} · 月费 ${money(plan.price)}</span>
                <button class="${tutorialTargetClass("buyPlan", plan.id)}" data-buy-plan="${plan.id}" ${state.phoneNumber && !(state.phonePlan?.active && state.phonePlan.id === plan.id) ? "" : "disabled"}>${state.phonePlan?.active && state.phonePlan.id === plan.id ? "本月已生效" : state.phonePlan?.id === plan.id ? "续费" : "办理"}</button>
              </div>
            `,
          )
          .join("")}
      </div>
      ${renderPaymentSummary()}
      <h3>号码服务</h3>
      ${renderSpendList("carrier", "办理")}
      <h3>营业厅账单</h3>
      ${renderRecordList(recordsForAny("carrier"), "还没有营业厅账单。")}
    </section>
  `;
}

function renderBankApp() {
  return `
    ${appHeader("XX银行", state.cards.length ? "银行卡管理" : "先办理一张银行卡")}
    <section class="app-body bank-body">
      ${renderPaymentSummary()}
      ${state.cards.length ? "" : `<button class="primary ${tutorialTargetClass("newCard")}" data-new-card="true" ${hasActivePlan() ? "" : "disabled"}>办理新银行卡</button>`}
      ${hasActivePlan() ? "" : `<p class="warning">${blockReasonForApp("bank")}</p>`}
      <div class="section-title">
        <h3>我的银行卡</h3>
        ${state.cards.length ? `<button class="${tutorialTargetClass("newCard")}" data-new-card="true" ${hasActivePlan() ? "" : "disabled"}>再办一张</button>` : ""}
      </div>
      ${renderCards()}
      <h3>银行服务</h3>
      ${renderSpendList("bank", "办理")}
      <h3>银行服务账单</h3>
      ${renderRecordList(recordsForAny("bank"), "还没有银行服务账单。")}
      <h3>贷款与月供</h3>
      ${renderLoanList()}
      <div class="form-card">
        <h3>从点钞转入银行卡</h3>
        <label>银行卡号</label>
        <div class="input-line">
          <input data-card-number value="${state.transferDraft.cardNumber}" placeholder="输入或粘贴银行卡号" />
          <button class="${tutorialTargetClass("pasteCard")}" data-paste-card="true">粘贴</button>
        </div>
        <label>金额</label>
        <input data-transfer-amount type="number" min="1" step="100" value="${state.transferDraft.amount}" />
        <button class="danger ${tutorialTargetClass("transferToCard")}" data-transfer-to-card="true">确认转账</button>
        <p class="warning">卡号输错，钱会转进虚空，无法找回。</p>
      </div>
      <h3>银行卡流水</h3>
      ${renderTransactions(8)}
    </section>
  `;
}

function renderPaymentSummary() {
  const creditReady = state.credit.enabled;
  const defaultCard = state.cards.find((card) => card.id === state.defaultCardId);
  return `
    <div class="payment-summary">
      <span>银行卡可支付余额</span>
      <strong>${money(totalCardBalance())}</strong>
      <small>${state.cards.length ? `${state.cards.length} 张卡可用${defaultCard ? `，默认 ${defaultCard.name}` : ""}。点钞余额不能直接消费。${creditReady ? ` 信用可用 ${money(creditAvailable())}。` : ""}` : "需要先办理银行卡，并从点钞 App 转入余额。"}</small>
      <div class="payment-method" aria-label="支付方式">
        <button data-payment-method="card" aria-pressed="${state.checkoutMethod !== "credit" ? "true" : "false"}">银行卡</button>
        <button data-payment-method="credit" aria-pressed="${state.checkoutMethod === "credit" ? "true" : "false"}" ${creditReady ? "" : "disabled"}>信用额度</button>
      </div>
      <small>当前消费目录使用${checkoutMethodLabel()}付款。转账、投资、房产和部分政务项目会按真实限制拦截。</small>
    </div>
  `;
}

function currentFoodDraft() {
  const draft = { ...defaultState.foodDraft, ...(state.foodDraft || {}) };
  if (!foodAddressBook.some((item) => item.id === draft.addressId)) draft.addressId = defaultState.foodDraft.addressId;
  if (!foodDeliveryModes.some((item) => item.id === draft.deliveryMode)) draft.deliveryMode = defaultState.foodDraft.deliveryMode;
  if (!foodCoupons.some((item) => item.id === draft.couponId)) draft.couponId = defaultState.foodDraft.couponId;
  draft.riderTip = Math.max(0, Math.min(20, Math.floor(Number(draft.riderTip) || 0)));
  draft.tableware = draft.tableware === "none" ? "none" : "need";
  draft.privacyNumber = draft.privacyNumber !== false;
  draft.invoice = Boolean(draft.invoice);
  draft.note = String(draft.note || "").trim().slice(0, 50);
  return draft;
}

function updateFoodDraft(patch) {
  state.foodDraft = { ...currentFoodDraft(), ...patch };
}

function foodDeliveryEligible(item) {
  return foodPhysicalTags.has(item.tag);
}

function foodOrderBreakdown(item) {
  const draft = currentFoodDraft();
  const address = foodAddressBook.find((entry) => entry.id === draft.addressId) || foodAddressBook[0];
  const delivery = foodDeliveryModes.find((entry) => entry.id === draft.deliveryMode) || foodDeliveryModes[0];
  const base = Math.max(1, Math.floor(Number(item.price) || 0));
  const deliveryEligible = foodDeliveryEligible(item);
  const pickup = foodPickupTags.has(item.tag);
  const subscription = item.asset === "subscription";
  const packingFee = deliveryEligible ? Math.max(2, Math.ceil(base * (item.tag === "聚餐" ? 0.05 : 0.035))) : item.tag === "自取" ? 1 : 0;
  let deliveryFee = deliveryEligible ? delivery.fee : 0;
  if (item.tag === "买菜") deliveryFee = Math.max(deliveryFee, 6);
  if (item.tag === "跑腿") deliveryFee += 8;
  const serviceFee = deliveryEligible || pickup ? Math.max(1, Math.floor(base * 0.018)) : 0;
  const riderTip = deliveryEligible ? draft.riderTip : 0;
  const coupon = foodCoupons.find((entry) => entry.id === draft.couponId) || foodCoupons[0];
  const couponAllowed = !subscription && !item.hold && base >= Math.max(0, coupon.min || 0);
  const discountBase = base + packingFee + deliveryFee + serviceFee + riderTip;
  let discount = 0;
  if (couponAllowed) {
    discount = coupon.deliveryOnly ? Math.min(deliveryFee, coupon.discount) : Math.min(coupon.discount, discountBase - 1);
  }
  const total = Math.max(1, discountBase - discount);
  const eta = deliveryEligible ? delivery.eta : item.tag === "自取" ? "门店出杯后可取" : item.tag === "订座" ? "按预约时间保留桌位" : "券码立即入账";
  const deliveryLabel = deliveryEligible ? delivery.label : item.tag === "自取" ? "到店自取" : item.tag === "团购" ? "到店核销" : item.tag === "订座" ? "订座保留" : "线上权益";
  const merchant = item.tag === "买菜" ? "MoneyOS 超市小时达" : item.tag === "跑腿" ? "MoneyOS 跑腿帮买" : item.tag === "团购" || item.tag === "订座" ? "附近到店餐饮" : "附近外卖商家";
  const lines = [
    ["商品原价", base],
    ["包装/餐具费", packingFee],
    ["配送/履约费", deliveryFee],
    ["平台服务费", serviceFee],
    ["骑手小费", riderTip],
    ["优惠券", -discount],
  ].filter(([, amount]) => amount);
  const summaryParts = [
    packingFee ? `包装 ${money(packingFee)}` : "",
    deliveryFee ? `配送 ${money(deliveryFee)}` : "",
    serviceFee ? `服务费 ${money(serviceFee)}` : "",
    riderTip ? `小费 ${money(riderTip)}` : "",
    discount ? `优惠 -${money(discount)}` : "",
  ].filter(Boolean);
  return {
    address,
    deliveryLabel,
    eta,
    merchant,
    base,
    packingFee,
    deliveryFee,
    serviceFee,
    riderTip,
    discount,
    total,
    lines,
    summary: summaryParts.length ? summaryParts.join("、") : "无额外费用",
    couponLabel: discount ? coupon.label : "未用优惠",
    tableware: draft.tableware,
    privacyNumber: draft.privacyNumber,
    invoice: draft.invoice,
    note: draft.note,
    promise: deliveryEligible ? delivery.promise : "到店或权益类订单以券码/预约记录履约",
  };
}

function currentShopDraft() {
  const draft = { ...defaultState.shopDraft, ...(state.shopDraft || {}) };
  if (!shopAddressBook.some((item) => item.id === draft.addressId)) draft.addressId = defaultState.shopDraft.addressId;
  if (!shopShippingModes.some((item) => item.id === draft.shippingMode)) draft.shippingMode = defaultState.shopDraft.shippingMode;
  if (!shopCoupons.some((item) => item.id === draft.couponId)) draft.couponId = defaultState.shopDraft.couponId;
  draft.freightInsurance = draft.freightInsurance !== false;
  draft.invoice = draft.invoice !== false;
  draft.giftWrap = Boolean(draft.giftWrap);
  draft.remark = String(draft.remark || "").trim().slice(0, 60);
  return draft;
}

function updateShopDraft(patch) {
  state.shopDraft = { ...currentShopDraft(), ...patch };
}

function shopCartEligible(item) {
  return item && item.asset !== "subscription" && item.asset !== "policy";
}

function sanitizedShopCart() {
  const catalog = spendCatalogs.shop || [];
  const merged = [];
  (Array.isArray(state.shopCart) ? state.shopCart : []).forEach((entry) => {
    const item = catalog.find((candidate) => candidate.id === entry.itemId);
    if (!shopCartEligible(item)) return;
    const quantity = Math.max(1, Math.min(9, Math.floor(Number(entry.quantity) || 1)));
    const existing = merged.find((candidate) => candidate.itemId === item.id);
    if (existing) existing.quantity = Math.min(9, existing.quantity + quantity);
    else merged.push({ itemId: item.id, quantity });
  });
  state.shopCart = merged.slice(0, 12);
  return state.shopCart;
}

function shopCartLineItems() {
  return sanitizedShopCart()
    .map((entry) => {
      const item = (spendCatalogs.shop || []).find((candidate) => candidate.id === entry.itemId);
      if (!item) return null;
      const quantity = Math.max(1, Math.min(9, Math.floor(Number(entry.quantity) || 1)));
      return {
        id: item.id,
        name: item.name,
        tag: item.tag,
        price: item.price,
        quantity,
        subtotal: item.price * quantity,
      };
    })
    .filter(Boolean);
}

function shopCartBaseItem() {
  const lines = shopCartLineItems();
  if (!lines.length) return null;
  const base = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const names = lines.map((line) => `${line.name}×${line.quantity}`).join("、");
  return {
    id: SHOP_CART_ID,
    name: `购物车 ${lines.reduce((sum, line) => sum + line.quantity, 0)} 件合并结算`,
    price: base,
    tag: "购物车",
    desc: `购物车合并付款，包含${names}。平台会按真实电商规则拆单、发货、售后。`,
    status: "多商家已接单",
    cartLines: lines,
  };
}

function addShopCartItem(itemId) {
  const item = (spendCatalogs.shop || []).find((entry) => entry.id === itemId);
  if (!shopCartEligible(item)) {
    addNotice("这个商品需要单独购买，不能放进购物车。");
    render();
    return;
  }
  const cart = sanitizedShopCart();
  const existing = cart.find((entry) => entry.itemId === item.id);
  if (existing) existing.quantity = Math.min(9, existing.quantity + 1);
  else cart.push({ itemId: item.id, quantity: 1 });
  state.shopCart = cart.slice(0, 12);
  addNotice(`${item.name} 已加入购物车`);
  render();
}

function updateShopCartQuantity(itemId, delta) {
  const cart = sanitizedShopCart();
  const entry = cart.find((item) => item.itemId === itemId);
  if (!entry) return;
  entry.quantity = Math.max(0, Math.min(9, Math.floor(Number(entry.quantity) || 1) + delta));
  state.shopCart = cart.filter((item) => item.quantity > 0);
  render();
}

function removeShopCartItem(itemId) {
  state.shopCart = sanitizedShopCart().filter((item) => item.itemId !== itemId);
  render();
}

function shopLineItemsFor(item) {
  if (Array.isArray(item.cartLines) && item.cartLines.length) return item.cartLines;
  return [{ id: item.id, name: item.name, tag: item.tag, price: item.price, quantity: 1, subtotal: item.price }];
}

function hasActiveShopPlus() {
  return state.subscriptions.some((item) => item.source === "shop" && !String(item.status || "").includes("取消"));
}

function shopOrderBreakdown(item) {
  const draft = currentShopDraft();
  const address = shopAddressBook.find((entry) => entry.id === draft.addressId) || shopAddressBook[0];
  const shipping = shopShippingModes.find((entry) => entry.id === draft.shippingMode) || shopShippingModes[0];
  const lineItems = shopLineItemsFor(item);
  const base = Math.max(1, Math.floor(lineItems.reduce((sum, line) => sum + Number(line.subtotal || 0), 0) || Number(item.price) || 0));
  const physical = item.asset !== "subscription" && item.asset !== "policy";
  const hasLargeItem = lineItems.some((line) => shopLargeTags.has(line.tag));
  const hasImportedItem = lineItems.some((line) => shopImportedTags.has(line.tag));
  let freightFee = physical ? shipping.fee : 0;
  if (physical && shipping.id === "standard" && base >= 199) freightFee = 0;
  if (physical && hasLargeItem) freightFee = Math.max(freightFee, shipping.id === "scheduled" ? 80 : 36);
  const installFee = physical && hasLargeItem ? (lineItems.some((line) => line.tag === "家具") ? 120 : 80) : 0;
  const importTax = physical && hasImportedItem ? Math.floor(base * 0.091) : 0;
  const serviceFee = physical ? Math.max(1, Math.floor(base * 0.006)) : 0;
  const freightInsuranceFee = physical && draft.freightInsurance ? Math.max(3, Math.min(69, Math.ceil(base * 0.006))) : 0;
  const giftWrapFee = physical && draft.giftWrap && !hasLargeItem ? 18 : 0;
  const coupon = shopCoupons.find((entry) => entry.id === draft.couponId) || shopCoupons[0];
  const couponBase = base + freightFee + installFee + importTax + serviceFee + freightInsuranceFee + giftWrapFee;
  const couponAllowed = physical && base >= Math.max(0, coupon.min || 0);
  let discount = 0;
  if (couponAllowed) {
    discount = coupon.deliveryOnly ? Math.min(freightFee, coupon.discount) : Math.min(coupon.discount, couponBase - 1);
  }
  const shopPlusDiscount = physical && hasActiveShopPlus() ? Math.min(18, freightFee + serviceFee) : 0;
  const total = Math.max(1, couponBase - discount - shopPlusDiscount);
  const merchant = item.id === SHOP_CART_ID
    ? "MoneyOS 多商家购物车"
    : hasImportedItem
      ? "MoneyOS 保税仓"
      : item.tag === "数码" || item.tag === "办公"
        ? "MoneyOS 自营旗舰店"
        : "品牌授权店";
  const lines = [
    ["商品金额", base],
    ["运费/送装费", freightFee],
    ["安装服务费", installFee],
    ["进口税费预估", importTax],
    ["平台服务费", serviceFee],
    ["运费险", freightInsuranceFee],
    ["礼品包装", giftWrapFee],
    ["店铺/平台优惠", -discount],
    ["省钱会员抵扣", -shopPlusDiscount],
  ].filter(([, amount]) => amount);
  const summaryParts = [
    freightFee ? `运费 ${money(freightFee)}` : "",
    installFee ? `送装 ${money(installFee)}` : "",
    importTax ? `税费 ${money(importTax)}` : "",
    serviceFee ? `服务费 ${money(serviceFee)}` : "",
    freightInsuranceFee ? `运费险 ${money(freightInsuranceFee)}` : "",
    giftWrapFee ? `包装 ${money(giftWrapFee)}` : "",
    discount ? `优惠 -${money(discount)}` : "",
    shopPlusDiscount ? `会员抵扣 -${money(shopPlusDiscount)}` : "",
  ].filter(Boolean);
  const refundRate = item.asset === "subscription" ? 0.35 : item.asset === "policy" ? 0.72 : hasImportedItem ? 0.88 : draft.freightInsurance ? 0.96 : 0.92;
  const refundFee = Math.max(1, total - Math.floor(total * refundRate));
  return {
    address,
    shippingLabel: physical ? shipping.label : "线上权益",
    eta: physical ? shipping.eta : "立即生效",
    merchant,
    base,
    freightFee,
    installFee,
    importTax,
    serviceFee,
    freightInsuranceFee,
    giftWrapFee,
    discount,
    shopPlusDiscount,
    total,
    lines,
    lineItems,
    summary: summaryParts.length ? summaryParts.join("、") : "无额外费用",
    couponLabel: discount ? coupon.label : "未用优惠",
    freightInsurance: Boolean(freightInsuranceFee),
    invoice: draft.invoice,
    giftWrap: Boolean(giftWrapFee),
    remark: draft.remark,
    promise: physical ? shipping.promise : "数字权益/会员服务以账户开通记录履约",
    returnRule: item.asset === "subscription"
      ? "会员权益生效后仅退未使用部分"
      : item.asset === "policy"
        ? "服务保单按退保规则扣除已生效天数"
        : hasImportedItem
          ? "跨境/美妆拆封影响退款，税费可能不退"
          : "支持 7 天无理由，退货运费按运费险/责任方结算",
    refundRate,
    refundFee,
  };
}

function currentTravelDraft() {
  const draft = { ...defaultState.travelDraft, ...(state.travelDraft || {}) };
  if (!travelPassengers.some((item) => item.id === draft.passengerId)) draft.passengerId = defaultState.travelDraft.passengerId;
  if (!travelDateSlots.some((item) => item.id === draft.dateSlot)) draft.dateSlot = defaultState.travelDraft.dateSlot;
  if (!travelServiceLevels.some((item) => item.id === draft.serviceLevel)) draft.serviceLevel = defaultState.travelDraft.serviceLevel;
  if (!travelBaggageOptions.some((item) => item.id === draft.baggage)) draft.baggage = defaultState.travelDraft.baggage;
  if (!travelRefundRules.some((item) => item.id === draft.refundRule)) draft.refundRule = defaultState.travelDraft.refundRule;
  if (!travelCoupons.some((item) => item.id === draft.couponId)) draft.couponId = defaultState.travelDraft.couponId;
  draft.insurance = draft.insurance !== false;
  draft.invoice = draft.invoice !== false;
  draft.autoCheckIn = draft.autoCheckIn !== false;
  draft.remark = String(draft.remark || "").trim().slice(0, 60);
  return draft;
}

function updateTravelDraft(patch) {
  state.travelDraft = { ...currentTravelDraft(), ...patch };
}

function travelRouteFor(item) {
  const routes = {
    train: "上海虹桥 → 北京南 G88",
    flight: "上海浦东 T2 → 深圳宝安 MU5200",
    hotel: "北京国贸商务酒店 · 两晚大床房",
    resort: "上海 → MoneyBay 海岛 · 四天三晚",
    ticket: "苏州乐园 · 10:00-12:00 入园",
    "car-rent": "北京南站取车 → 首都机场还车",
    "hotel-hold": "北京国贸商务酒店前台 · 离店释放",
    "visa-service": "MoneyOS 签证中心 → 领馆预约",
    "flight-change": "MU5200 → MU5318 改签确认",
    baggage: "MU5200 航班 · 托运行李服务",
    "airport-lounge": "上海浦东 T2 · 贵宾厅券码",
    "wifi-hold": "出境 Wi-Fi 柜台取还设备",
  };
  return routes[item.id] || `${item.name} · MoneyOS 行程`;
}

function travelMerchantFor(item) {
  if (item.tag === "火车票") return "MoneyOS 铁路票务";
  if (["机票", "改签", "行李", "权益"].includes(item.tag)) return "MoneyOS 航空服务";
  if (travelStayTags.has(item.tag)) return "MoneyOS 酒店旅行";
  if (item.tag === "门票") return "MoneyOS 景区预约";
  if (item.tag === "租车") return "MoneyOS 租车";
  if (item.tag === "签证") return "MoneyOS 签证中心";
  return "MoneyOS 旅行";
}

function travelFulfillmentLabel(item) {
  if (item.tag === "火车票") return "出票后刷身份证进站";
  if (item.tag === "机票") return "出票 + 在线值机";
  if (item.tag === "酒店") return "入住人资料预填";
  if (item.tag === "度假") return "出团通知 + 接送确认";
  if (item.tag === "门票") return "实名预约入园";
  if (item.tag === "租车") return "取车验车单";
  if (item.tag === "预授权" || item.tag === "押金") return "柜台冻结/离店验收释放";
  if (item.tag === "签证") return "材料清单核验";
  if (item.tag === "改签") return "新行程短信确认";
  if (item.tag === "行李") return "航司附加服务确认";
  if (item.tag === "权益") return "券码核销";
  return "行程确认";
}

function travelServiceLabel(item, serviceLevel) {
  if (serviceLevel.id === "basic") return serviceLevel.desc;
  if (travelTrafficTags.has(item.tag)) return serviceLevel.id === "premium" ? "前排/靠窗偏好 + 快速通道" : "靠窗/连坐偏好";
  if (travelStayTags.has(item.tag)) return serviceLevel.id === "premium" ? "高楼层房型 + 延迟退房" : "含早/安静房偏好";
  if (item.tag === "租车") return serviceLevel.id === "premium" ? "升级车型 + 免排队取车" : "车型优先确认";
  if (item.tag === "门票") return serviceLevel.id === "premium" ? "快速入园 + 专人提醒" : "热门时段预约";
  if (item.tag === "签证") return serviceLevel.id === "premium" ? "加急审核 + 专人复核" : "材料复核";
  return serviceLevel.desc;
}

function travelInsuranceFee(item, base) {
  if (item.asset === "policy") return 0;
  if (item.hold) return 0;
  if (item.tag === "租车") return 48;
  if (item.tag === "门票") return 12;
  if (item.tag === "酒店") return 28;
  if (item.tag === "签证") return 32;
  if (item.tag === "权益") return 0;
  return Math.max(15, Math.ceil(base * 0.018));
}

function travelRefundRateFor(item, refundRule) {
  if (item.hold) return Math.max(0.1, Math.min(1, Number(item.refundRate) || 1));
  if (item.tag === "签证") return 0.25;
  if (item.tag === "改签") return 0.18;
  if (item.tag === "行李") return 0.45;
  if (item.tag === "权益") return 0.55;
  if (item.tag === "门票") return Math.min(0.9, refundRule.refundRate + 0.02);
  return Math.max(0.1, Math.min(0.98, refundRule.refundRate));
}

function travelReturnRuleFor(item, refundRate) {
  if (item.hold) return `预授权按酒店/设备验收释放，预计可退 ${money(Math.floor(item.price * (item.refundRate || 1)))}`;
  if (item.tag === "签证") return "签证材料审核后服务费不退，只退未发生代缴";
  if (item.tag === "改签") return "改签费和舱位差价支付后基本不退";
  if (item.tag === "行李") return "行李额起飞前可退部分，起飞后不可退";
  if (item.tag === "权益") return "券码未核销前可退部分，过期不退";
  return `退订预计可退 ${Math.round(refundRate * 100)}%，平台和供应商会扣费`;
}

function travelBookingBreakdown(item) {
  const draft = currentTravelDraft();
  const passenger = travelPassengers.find((entry) => entry.id === draft.passengerId) || travelPassengers[0];
  const dateSlot = travelDateSlots.find((entry) => entry.id === draft.dateSlot) || travelDateSlots[0];
  const serviceLevel = travelServiceLevels.find((entry) => entry.id === draft.serviceLevel) || travelServiceLevels[0];
  const baggage = travelBaggageOptions.find((entry) => entry.id === draft.baggage) || travelBaggageOptions[0];
  const refundRule = travelRefundRules.find((entry) => entry.id === draft.refundRule) || travelRefundRules[1];
  const coupon = travelCoupons.find((entry) => entry.id === draft.couponId) || travelCoupons[0];
  const base = Math.max(1, Math.floor(Number(item.price) || 0));
  const demandFee = Math.floor(base * dateSlot.feeRate);
  const serviceFee = Math.max(0, item.hold ? 0 : Math.floor(serviceLevel.fee * (base > 5000 ? 1.7 : base > 1000 ? 1.25 : 1)));
  const baggageFee = travelBaggageTags.has(item.tag) && item.id !== "baggage" ? baggage.fee : 0;
  const insuranceFee = draft.insurance ? travelInsuranceFee(item, base) : 0;
  const refundProtectFee = item.hold ? 0 : Math.floor(base * refundRule.feeRate);
  const autoCheckInFee = draft.autoCheckIn && !item.hold ? (travelStayTags.has(item.tag) ? 16 : 25) : 0;
  const platformFee = item.hold ? 0 : Math.max(3, Math.floor((base + demandFee) * 0.012));
  const passengerDiscount = passenger.id === "child" && ["火车票", "机票", "门票"].includes(item.tag) ? Math.floor(base * (item.tag === "机票" ? 0.25 : 0.35)) : 0;
  const couponBase = base + demandFee + serviceFee + baggageFee + insuranceFee + refundProtectFee + autoCheckInFee + platformFee - passengerDiscount;
  const couponAllowed = couponBase >= Math.max(0, coupon.min || 0) && (!coupon.tags || coupon.tags.includes(item.tag));
  const couponDiscount = couponAllowed ? Math.min(coupon.discount, Math.max(0, couponBase - 1)) : 0;
  const total = Math.max(1, couponBase - couponDiscount);
  const refundRate = travelRefundRateFor(item, refundRule);
  const refundFee = Math.max(0, total - Math.floor(total * refundRate));
  const lines = [
    ["基础价格", base],
    ["日期/库存浮动", demandFee],
    ["规格/选座服务", serviceFee],
    ["额外行李", baggageFee],
    ["出行保障", insuranceFee],
    ["退改保障", refundProtectFee],
    ["值机/入住助手", autoCheckInFee],
    ["平台服务费", platformFee],
    ["儿童/学生优惠", -passengerDiscount],
    ["出行券", -couponDiscount],
  ].filter(([, amount]) => amount);
  const summaryParts = [
    demandFee ? `浮动 ${money(demandFee)}` : "",
    serviceFee ? `规格 ${money(serviceFee)}` : "",
    baggageFee ? `行李 ${money(baggageFee)}` : "",
    insuranceFee ? `保障 ${money(insuranceFee)}` : "",
    refundProtectFee ? `退改 ${money(refundProtectFee)}` : "",
    autoCheckInFee ? `助手 ${money(autoCheckInFee)}` : "",
    platformFee ? `服务费 ${money(platformFee)}` : "",
    passengerDiscount ? `儿童优惠 -${money(passengerDiscount)}` : "",
    couponDiscount ? `券 -${money(couponDiscount)}` : "",
  ].filter(Boolean);
  const returnRule = travelReturnRuleFor(item, refundRate);
  return {
    passenger,
    dateSlot,
    serviceLevel,
    baggage,
    refundRule,
    merchant: travelMerchantFor(item),
    route: travelRouteFor(item),
    fulfillmentLabel: travelFulfillmentLabel(item),
    serviceLabel: travelServiceLabel(item, serviceLevel),
    base,
    demandFee,
    serviceFee,
    baggageFee,
    insuranceFee,
    refundProtectFee,
    autoCheckInFee,
    platformFee,
    passengerDiscount,
    couponDiscount,
    total,
    lines,
    summary: summaryParts.length ? summaryParts.join("、") : "无额外费用",
    couponLabel: couponDiscount ? coupon.label : "未用出行券",
    insurance: Boolean(insuranceFee),
    invoice: draft.invoice,
    autoCheckIn: Boolean(autoCheckInFee),
    remark: draft.remark,
    returnRule,
    refundRate,
    refundFee,
  };
}

function catalogItemForCheckout(category, item) {
  if (category === "food") {
    const foodBreakdown = foodOrderBreakdown(item);
    return {
      ...item,
      price: foodBreakdown.total,
      desc: `${item.desc} 实付包含${foodBreakdown.summary}。`,
      foodBreakdown,
    };
  }
  if (category === "shop") {
    const shopBreakdown = shopOrderBreakdown(item);
    return {
      ...item,
      price: shopBreakdown.total,
      desc: `${item.desc} 实付包含${shopBreakdown.summary}。`,
      shopBreakdown,
    };
  }
  if (category === "travel") {
    const travelBreakdown = travelBookingBreakdown(item);
    return {
      ...item,
      price: travelBreakdown.total,
      desc: `${item.desc} 实付包含${travelBreakdown.summary}。`,
      travelBreakdown,
      refundRate: travelBreakdown.refundRate,
    };
  }
  return item;
}

function renderCheckoutBreakdown(item) {
  const breakdown = item.foodBreakdown || item.shopBreakdown || item.travelBreakdown;
  if (!breakdown?.lines?.length) return "";
  return `
    <div class="checkout-breakdown">
      ${breakdown.lines
        .map(
          ([label, amount]) => `
            <div>
              <span>${escapeHtml(label)}</span>
              <b>${amount < 0 ? "-" : ""}${money(Math.abs(amount))}</b>
            </div>
          `,
        )
        .join("")}
      <small>${escapeHtml(breakdown.couponLabel)} · ${escapeHtml(breakdown.promise)}</small>
    </div>
  `;
}

function renderSpendList(category, buttonText = "支付") {
  const items = spendCatalogs[category] || [];
  const activeTag = state.spendFilters?.[category] || "全部";
  const tags = ["全部", ...Array.from(new Set(items.map((item) => item.tag))).filter(Boolean)];
  const visibleItems = activeTag === "全部" ? items : items.filter((item) => item.tag === activeTag);
  return `
    <div class="spend-filter" aria-label="消费分类筛选">
      ${tags
        .map(
          (tag) => `
            <button data-spend-filter-category="${category}" data-spend-filter-tag="${escapeHtml(tag)}" aria-pressed="${activeTag === tag ? "true" : "false"}">
              ${escapeHtml(tag)}
            </button>
          `,
        )
        .join("")}
    </div>
    <div class="spend-list">
      ${visibleItems
        .map(
          (item) => `
            <article class="spend-item">
              <div>
                <span class="spend-tag">${item.tag}</span>
                <strong>${item.name}</strong>
                <p>${item.desc}</p>
                <small class="checkout-line">${escapeHtml(checkoutLineFor(category, item))}</small>
                ${renderSpendFlags(item)}
              </div>
              <div class="spend-action">
                <b>${money(item.price)}</b>
                <button class="primary" data-spend-category="${category}" data-spend-id="${item.id}">${buttonText}</button>
              </div>
            </article>
          `,
        )
        .join("")}
      ${visibleItems.length ? "" : `<p class="empty">这个分类下暂时没有可花钱项目。</p>`}
    </div>
  `;
}

function checkoutItemFromDraft() {
  const draft = state.checkoutDraft;
  if (!draft?.category || !draft?.itemId) return null;
  if (draft.category === "shop" && draft.itemId === SHOP_CART_ID) {
    const item = shopCartBaseItem();
    return item ? { category: draft.category, item: catalogItemForCheckout(draft.category, item) } : null;
  }
  const item = (spendCatalogs[draft.category] || []).find((entry) => entry.id === draft.itemId);
  if (!item) return null;
  return { category: draft.category, item: catalogItemForCheckout(draft.category, item) };
}

function checkoutBlockReason(category, item) {
  if (categoryRequiresNetwork(category) && !hasActivePlan()) return blockReasonForApp(category);
  if (category === "carrier" && !state.phoneNumber) return "需要先在营业厅购买手机号。";
  if (category === "carrier" && item.id === "premium-plan") {
    if (state.carrierBalance < carrierPlans.premium.price) return `话费余额不足，还差 ${money(carrierPlans.premium.price - state.carrierBalance)}。`;
    return "";
  }
  if (category === "bank" && !state.cards.length) return "需要先在 XX银行办理银行卡。";
  if (category === "credit") {
    if (!state.credit.enabled) return "需要先开通信用账户。";
    const needed = item.months ? item.price + Math.ceil(item.price * 0.036) : item.price;
    if (creditAvailable() < needed) return `信用可用额度不足，还差 ${money(needed - creditAvailable())}。`;
    return "";
  }

  if (state.checkoutMethod === "credit") {
    const reason = creditBlockReason(category, item);
    if (reason) return reason;
    if (creditAvailable() < item.price) return `信用可用额度不足，还差 ${money(item.price - creditAvailable())}。`;
    return "";
  }

  if (!state.cards.length) return "需要先办理银行卡，并从点钞余额转入银行卡。";
  if (totalCardBalance() < item.price) return `银行卡余额不足，还差 ${money(item.price - totalCardBalance())}。`;
  if (!state.cards.some((card) => Number(card.balance) >= item.price)) return "没有单张银行卡余额足够支付这笔订单。";
  return "";
}

function renderCheckoutSheet() {
  const draft = checkoutItemFromDraft();
  if (!draft) return "";
  const { category, item } = draft;
  const meta = makePaymentMeta(category, item, { amount: item.price });
  const blockReason = checkoutBlockReason(category, item);
  const categoryName = apps[category]?.name || "消费";
  const creditFixed = category === "credit";
  const carrierPlanFixed = category === "carrier" && item.id === "premium-plan";
  const paymentLabel = carrierPlanFixed ? "话费余额" : creditFixed ? "信用额度" : checkoutMethodLabel();
  const methodHint = creditFixed
    ? `信用可用 ${money(creditAvailable())}，分期商品会把手续费一起占用额度。`
    : carrierPlanFixed
      ? `话费余额 ${money(state.carrierBalance)}，套餐费从话费扣。`
    : state.checkoutMethod === "credit"
      ? `信用可用 ${money(creditAvailable())}，部分真实场景会被限制。`
      : `${state.cards.length ? `${state.cards.length} 张银行卡可用` : "暂无银行卡"}，余额 ${money(totalCardBalance())}`;
  return `
    <div class="checkout-overlay" role="presentation">
      <button class="checkout-backdrop" data-close-checkout="true" aria-label="关闭付款确认"></button>
      <article class="checkout-sheet" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle">
        <header class="checkout-head">
          <div>
            <span>${escapeHtml(categoryName)}确认付款</span>
            <strong id="checkoutTitle">${escapeHtml(item.name)}</strong>
          </div>
          <button class="plain-button" data-close-checkout="true" aria-label="关闭">×</button>
        </header>
        <div class="checkout-scroll">
          <div class="checkout-price">
            <span>应付金额</span>
            <strong>${money(item.price)}</strong>
          </div>
          ${renderCheckoutBreakdown(item)}
          <dl class="checkout-details">
            <div><dt>商户</dt><dd>${escapeHtml(meta.merchant)}</dd></div>
            <div><dt>订单号</dt><dd>${escapeHtml(meta.orderNo)}</dd></div>
            <div><dt>履约</dt><dd>${escapeHtml(meta.fulfillment)}</dd></div>
            <div><dt>资料</dt><dd>${escapeHtml(categoryProfileLine(category, item))}</dd></div>
            <div><dt>费用</dt><dd>${meta.serviceFee ? `平台服务费约 ${money(meta.serviceFee)}` : "无额外平台服务费"}</dd></div>
          </dl>
          <p class="checkout-protection">${escapeHtml(meta.protection)} ${escapeHtml(checkoutLineFor(category, item))}</p>
          ${
            creditFixed || carrierPlanFixed
              ? `<div class="checkout-method-static"><span>支付方式</span><strong>${paymentLabel}</strong><small>${methodHint}</small></div>`
              : `
                <div class="payment-method checkout-method" aria-label="支付方式">
                  <button data-payment-method="card" aria-pressed="${state.checkoutMethod !== "credit" ? "true" : "false"}">银行卡</button>
                  <button data-payment-method="credit" aria-pressed="${state.checkoutMethod === "credit" ? "true" : "false"}" ${state.credit.enabled ? "" : "disabled"}>信用额度</button>
                </div>
                <small class="checkout-method-hint">${escapeHtml(methodHint)}</small>
              `
          }
          ${blockReason ? `<p class="warning checkout-warning">${escapeHtml(blockReason)}</p>` : ""}
        </div>
        <div class="checkout-actions">
          <button data-close-checkout="true">取消</button>
          <button class="danger" data-confirm-checkout="true" ${blockReason ? "disabled" : ""}>确认${paymentLabel}支付</button>
        </div>
      </article>
    </div>
  `;
}

function renderRecordMeta(record) {
  if (!record.meta) return "";
  const feeText = Number(record.meta.serviceFee) > 0 ? `服务费约 ${money(record.meta.serviceFee)}` : "";
  const parts = [record.meta.merchant, record.meta.orderNo, record.meta.fulfillment, feeText].filter(Boolean);
  return parts.length ? `<small class="record-meta">${parts.map(escapeHtml).join(" · ")}</small>` : "";
}

function renderRecordList(records, emptyText = "暂无记录。") {
  if (!records.length) return `<p class="empty">${emptyText}</p>`;
  return records
    .slice(0, 6)
    .map(
      (record) => `
        <div class="list-row record-row">
          <div>
            <strong>${escapeHtml(record.title)}</strong>
            <span>${escapeHtml(record.time)} · ${escapeHtml(record.status || record.detail || "")}</span>
            ${renderRecordMeta(record)}
          </div>
          <b>${money(record.amount)}</b>
        </div>
      `,
    )
    .join("");
}

function recordsFor(category) {
  return state.orders.filter((order) => order.category === category);
}

function serviceRecordsFor(category) {
  return state.serviceRecords.filter((record) => record.category === category);
}

function recordsForAny(category) {
  return [...state.serviceRecords, ...state.orders, ...state.bookings]
    .filter((record) => record.category === category)
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
}

function renderLogisticsWorldMap() {
  const activeShipment = state.shipments.find((shipment) => !shipment.signed) || state.shipments[0];
  const route = activeShipment?.route?.length ? activeShipment.route : buildShipmentRoute("northport", "shanghai");
  const routeSet = new Set(route);
  const currentNodeId = route[Math.min(route.length - 1, Math.max(0, Math.floor(Number(activeShipment?.currentNodeIndex) || 0)))];
  const routePoints = route.map((id) => `${mapNode(id).x},${mapNode(id).y}`).join(" ");
  return `
    <section class="world-map" aria-label="MoneyOS 虚假国家物流地图">
      <header>
        <div>
          <span>后台国家地图</span>
          <strong>${activeShipment ? escapeHtml(activeShipment.title) : "暂无活包裹"}</strong>
        </div>
        <b>${activeShipment ? escapeHtml(activeShipment.status) : "等待下单"}</b>
      </header>
      <div class="map-canvas">
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <polyline class="map-route-shadow" points="${routePoints}" />
          <polyline class="map-route" points="${routePoints}" />
        </svg>
        ${moneyCountryNodes
          .map((node) => {
            const inRoute = routeSet.has(node.id);
            const current = node.id === currentNodeId;
            return `
              <span class="map-node ${inRoute ? "route-node" : ""} ${current ? "current-node" : ""}" style="--x:${node.x}%; --y:${node.y}%;">
                <i>${escapeHtml(node.name.slice(0, 1))}</i>
                <em>${escapeHtml(node.name)}</em>
              </span>
            `;
          })
          .join("")}
      </div>
      <p>${activeShipment ? `路线：${escapeHtml(routeNodeNames(route))}` : "买东西或寄件后，系统会给它生成一条看起来很真的路线。"}</p>
    </section>
  `;
}

function renderShipmentList() {
  if (!state.shipments.length) return `<p class="empty">还没有包裹。买点东西、寄个件，手机里就会开始自己忙活。</p>`;
  return state.shipments
    .slice(0, 8)
    .map((shipment) => {
      const route = shipment.route?.length ? shipment.route : buildShipmentRoute(shipment.originId, shipment.destinationId);
      const currentIndex = Math.min(route.length - 1, Math.max(0, Math.floor(Number(shipment.currentNodeIndex) || 0)));
      const progress = route.length <= 1 ? 100 : Math.round((currentIndex / (route.length - 1)) * 100);
      const canSign = shipment.stationNotified && !shipment.signed;
      return `
        <article class="shipment-card ${shipment.signed ? "signed-shipment" : ""}">
          <header>
            <div>
              <span>${escapeHtml(shipment.trackingNo || "MEX00000000")}</span>
              <strong>${escapeHtml(shipment.title)}</strong>
            </div>
            <b>${escapeHtml(shipment.status)}</b>
          </header>
          <div class="shipment-progress" aria-hidden="true"><span style="width:${progress}%"></span></div>
          <p>${escapeHtml(shipment.detail || `路线：${routeNodeNames(route)}`)}</p>
          <div class="route-chips">
            ${route
              .map((id, index) => {
                const node = mapNode(id);
                const className = index < currentIndex ? "done" : index === currentIndex ? "now" : "";
                return `<span class="${className}">${escapeHtml(node.name)}</span>`;
              })
              .join("")}
          </div>
          <div class="shipment-events">
            ${(shipment.events || [])
              .slice(0, 4)
              .map((event) => `<span><b>${escapeHtml(event.day || "")}</b>${escapeHtml(event.text)}</span>`)
              .join("")}
          </div>
          ${
            canSign
              ? `<button class="station-sign-button" data-sign-shipment="${escapeHtml(shipment.id)}">MoneyOS驿站签收</button>`
              : `<small>${shipment.signed ? `签收时间：${escapeHtml(shipment.signedAt || "刚刚")}` : "推进一天后会继续更新物流、电话和短信。"}</small>`
          }
        </article>
      `;
    })
    .join("");
}

function renderCommerceCategoryApp({ appId, title, subtitle, listTitle, buttonText, recordTitle, emptyText }) {
  return `
    ${appHeader(title, subtitle)}
    <section class="app-body commerce-body">
      ${renderPaymentSummary()}
      <h3>${listTitle}</h3>
      ${renderSpendList(appId, buttonText)}
      <h3>${recordTitle}</h3>
      ${renderRecordList(recordsForAny(appId), emptyText)}
    </section>
  `;
}

function renderAssetList(assets, emptyText) {
  if (!assets.length) return `<p class="empty">${emptyText}</p>`;
  return assets
    .slice(0, 5)
    .map(
      (asset) => `
        <article class="asset-card">
          <span>${escapeHtml(asset.kind || "资产")}</span>
          <strong>${escapeHtml(asset.name)}</strong>
          <p>${escapeHtml(asset.detail || asset.status || "")}</p>
          <b>${money(asset.amount)}</b>
        </article>
      `,
    )
    .join("");
}

function renderSubscriptionList() {
  if (!state.subscriptions.length) return `<p class="empty">还没有自动续费订阅。</p>`;
  return state.subscriptions
    .slice(0, 6)
    .map((item) => {
      const canceled = String(item.status || "").includes("取消");
      return `
        <article class="asset-card subscription-card">
          <span>${escapeHtml(item.cycle || "自动续费")}</span>
          <strong>${escapeHtml(item.name)}</strong>
          <p>${escapeHtml(item.status || "已开通")} · 下次扣费 ${escapeHtml(item.nextCharge || "下月同日")}</p>
          <b>${money(item.amount)}</b>
          <div class="asset-actions">
            <button data-renew-subscription="${item.id}" ${canceled ? "disabled" : ""}>续费一次</button>
            <button data-cancel-subscription="${item.id}" ${canceled ? "disabled" : ""}>取消续费</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRefundList() {
  if (!state.refunds.length) return `<p class="empty">还没有售后退款。</p>`;
  return state.refunds
    .slice(0, 5)
    .map(
      (refund) => `
        <div class="list-row record-row">
          <div>
            <strong>${escapeHtml(refund.title)}</strong>
            <span>${escapeHtml(refund.time)} · ${escapeHtml(refund.status)}</span>
          </div>
          <b>${money(refund.amount)}</b>
        </div>
      `,
    )
    .join("");
}

function renderHoldList(category = "") {
  const holds = category ? state.holds.filter((hold) => hold.category === category) : state.holds;
  if (!holds.length) return `<p class="empty">还没有押金或预授权。</p>`;
  return holds
    .slice(0, 6)
    .map((hold) => {
      const released = String(hold.status || "").includes("退还") || String(hold.status || "").includes("释放");
      return `
        <div class="list-row record-row hold-row">
          <div>
            <strong>${escapeHtml(hold.title)}</strong>
            <span>${escapeHtml(hold.time)} · ${escapeHtml(hold.status)} · 可退 ${money(hold.refundable || hold.amount)}</span>
            ${renderRecordMeta(hold)}
          </div>
          <button data-release-hold="${hold.id}" ${released ? "disabled" : ""}>${released ? "已退" : "退押金"}</button>
        </div>
      `;
    })
    .join("");
}

function renderCreditBills() {
  if (!state.credit.bills.length) return `<p class="empty">还没有信用账单。</p>`;
  return state.credit.bills
    .slice(0, 6)
    .map(
      (bill) => `
        <div class="transaction-row expense">
          <div>
            <strong>${escapeHtml(bill.title)}</strong>
            <span>${escapeHtml(bill.time)} · ${escapeHtml(bill.category || bill.type)} · ${escapeHtml(bill.status || "")}</span>
          </div>
          <b>${bill.type === "repay" ? "-" : ""}${money(bill.amount)}</b>
        </div>
      `,
    )
    .join("");
}

function renderInstallments() {
  if (!state.credit.installments.length) return `<p class="empty">还没有分期记录。</p>`;
  return state.credit.installments
    .slice(0, 5)
    .map((item) => {
      const remainingMonths = Math.max(0, Math.floor(Number(item.remainingMonths ?? item.months) || 0));
      return `
        <article class="asset-card">
          <span>${escapeHtml(item.months)} 期分期</span>
          <strong>${escapeHtml(item.title)}</strong>
          <p>每期约 ${money(item.monthly)} · 剩余 ${remainingMonths} 期 · ${escapeHtml(item.status)}</p>
          <b>${money(item.amount)}</b>
          <div class="asset-actions">
            <button data-pay-installment="${item.id}" ${remainingMonths ? "" : "disabled"}>${remainingMonths ? "还一期" : "已结清"}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderLoanList(category = "") {
  const loans = category ? state.loans.filter((loan) => loan.category === category) : state.loans;
  if (!loans.length) return `<p class="empty">还没有贷款或月供。</p>`;
  return loans
    .slice(0, 6)
    .map((loan) => {
      const remainingMonths = Math.max(0, Math.floor(Number(loan.remainingMonths ?? loan.months) || 0));
      return `
        <article class="asset-card loan-card">
          <span>${escapeHtml(loan.lender || "贷款")} · ${escapeHtml(loan.collateral || "资产")}</span>
          <strong>${escapeHtml(loan.title)}</strong>
          <p>本金 ${money(loan.principal)} · 每期 ${money(loan.monthly)} · 剩余 ${remainingMonths} 期 · ${escapeHtml(loan.status)}</p>
          <b>${money(loan.paidAmount || 0)} 已还</b>
          <div class="asset-actions">
            <button data-pay-loan="${loan.id}" ${remainingMonths ? "" : "disabled"}>${remainingMonths ? "还一期" : "已结清"}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTransactions(limit = 8) {
  if (!state.transactions.length) return `<p class="empty">还没有银行卡流水。</p>`;
  return state.transactions
    .slice(0, limit)
    .map((transaction) => {
      const incoming = transaction.direction === "in";
      return `
        <div class="transaction-row ${incoming ? "income" : "expense"}">
          <div>
            <strong>${escapeHtml(transaction.title)}</strong>
            <span>${escapeHtml(transaction.time)} · ${escapeHtml(transaction.category)} · ${escapeHtml(transaction.cardName || "")}${transaction.detail ? ` · ${escapeHtml(transaction.detail)}` : ""}</span>
          </div>
          <b>${incoming ? "+" : "-"}${money(transaction.amount)}</b>
        </div>
      `;
    })
    .join("");
}

function activeSubscriptions() {
  return state.subscriptions.filter((item) => !String(item.status || "").includes("取消"));
}

function activeLoans(category = "") {
  return state.loans.filter((loan) => {
    const remainingMonths = Math.max(0, Math.floor(Number(loan.remainingMonths ?? loan.months) || 0));
    return remainingMonths > 0 && (!category || loan.category === category);
  });
}

function activeInstallments() {
  return state.credit.installments.filter((item) => Math.max(0, Math.floor(Number(item.remainingMonths ?? item.months) || 0)) > 0);
}

function frozenHolds(category = "") {
  return state.holds.filter((hold) => {
    const released = String(hold.status || "").includes("退还") || String(hold.status || "").includes("释放");
    return !released && (!category || hold.category === category);
  });
}

function monthlyCommitmentTotal() {
  const subscriptionTotal = activeSubscriptions().reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.amount) || 0)), 0);
  const loanTotal = activeLoans().reduce((sum, loan) => sum + Math.max(0, Math.floor(Number(loan.monthly) || 0)), 0);
  const installmentTotal = activeInstallments().reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.monthly) || 0)), 0);
  const creditMinimum = state.credit.enabled && state.credit.used > 0 ? Math.min(Math.floor(state.credit.used), Math.max(100, Math.ceil(state.credit.used * 0.1))) : 0;
  return subscriptionTotal + loanTotal + installmentTotal + creditMinimum;
}

function allMoneyRecords(limit = 8) {
  return [...state.serviceRecords, ...state.orders, ...state.bookings, ...state.refunds]
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
    .slice(0, limit);
}

function renderFinanceStats() {
  const frozenTotal = frozenHolds().reduce((sum, hold) => sum + Math.max(0, Math.floor(Number(hold.amount) || 0)), 0);
  const activeDebt = activeLoans().reduce((sum, loan) => {
    const remaining = Math.max(0, Math.floor(Number(loan.remainingMonths ?? loan.months) || 0));
    return sum + remaining * Math.max(0, Math.floor(Number(loan.monthly) || 0));
  }, 0);
  const statCards = [
    ["银行卡余额", money(totalCardBalance()), `${state.cards.length} 张卡`],
    ["累计花掉", money(state.stats.moneySpent), `${state.stats.ordersPlaced + state.serviceRecords.length + state.bookings.length} 笔消费记录`],
    ["本月固定支出", money(monthlyCommitmentTotal()), "订阅、月供、分期、信用最低还款"],
    ["押金冻结", money(frozenTotal), `${frozenHolds().length} 笔未退`],
    ["信用已用", money(state.credit.used || 0), state.credit.enabled ? `可用 ${money(creditAvailable())}` : "未开通"],
    ["长期月供余额", money(activeDebt), `${activeLoans().length} 份贷款合同`],
  ];
  return `
    <div class="finance-grid">
      ${statCards
        .map(
          ([label, value, hint]) => `
            <article class="finance-card">
              <span>${label}</span>
              <strong>${value}</strong>
              <small>${hint}</small>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderCommitmentList() {
  const rows = [
    ...activeSubscriptions()
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        title: item.name,
        meta: `${item.cycle || "订阅"} · 下次扣费 ${item.nextCharge || "下月同日"}`,
        amount: item.amount,
        action: "renew-subscription",
        button: "续费",
      })),
    ...activeLoans()
      .slice(0, 4)
      .map((loan) => ({
        id: loan.id,
        title: loan.title,
        meta: `${loan.lender || "贷款"} · 剩余 ${Math.max(0, Math.floor(Number(loan.remainingMonths ?? loan.months) || 0))} 期`,
        amount: loan.monthly,
        action: "pay-loan",
        button: "还月供",
      })),
    ...activeInstallments()
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        title: item.title,
        meta: `信用分期 · 剩余 ${Math.max(0, Math.floor(Number(item.remainingMonths ?? item.months) || 0))} 期`,
        amount: item.monthly,
        action: "pay-installment",
        button: "还一期",
      })),
  ];
  const creditMinimum = state.credit.enabled && state.credit.used > 0 ? Math.min(state.credit.used, Math.max(100, Math.ceil(state.credit.used * 0.1))) : 0;
  if (creditMinimum) {
    rows.unshift({
      id: String(creditMinimum),
      title: "信用账单最低还款",
      meta: `已用额度 ${money(state.credit.used)}`,
      amount: creditMinimum,
      action: "credit-repay",
      button: "还最低",
    });
  }
  if (!rows.length) return `<p class="empty">还没有订阅、分期、贷款或信用待还。</p>`;
  return rows
    .slice(0, 9)
    .map((row) => {
      const dataAttr =
        row.action === "renew-subscription"
          ? `data-renew-subscription="${row.id}"`
          : row.action === "pay-loan"
            ? `data-pay-loan="${row.id}"`
            : row.action === "pay-installment"
              ? `data-pay-installment="${row.id}"`
              : `data-credit-repay="${row.id}"`;
      return `
        <div class="list-row commitment-row">
          <div>
            <strong>${escapeHtml(row.title)}</strong>
            <span>${escapeHtml(row.meta)}</span>
          </div>
          <b>${money(row.amount)}</b>
          <button ${dataAttr}>${row.button}</button>
        </div>
      `;
    })
    .join("");
}

function renderBillRuns() {
  if (!state.billRuns.length) return `<p class="empty">还没有批量扣款记录。</p>`;
  return state.billRuns
    .slice(0, 4)
    .map(
      (run) => `
        <div class="list-row record-row">
          <div>
            <strong>${escapeHtml(run.title)}</strong>
            <span>${escapeHtml(run.time)} · ${escapeHtml(run.status)}</span>
          </div>
          <b>${money(run.amount)}</b>
        </div>
      `,
    )
    .join("");
}

function renderBillHubApp() {
  return `
    ${appHeader("账单", "订单、押金、订阅、贷款和固定支出")}
    <section class="app-body commerce-body billhub-body">
      ${renderPaymentSummary()}
      ${renderFinanceStats()}
      <div class="bill-command">
        <div>
          <strong>本月固定支出</strong>
          <span>订阅、贷款和分期会逐笔扣款，余额不足会停在失败项。</span>
        </div>
        <button class="danger" data-pay-monthly="true" ${monthlyCommitmentTotal() ? "" : "disabled"}>一键支付 ${money(monthlyCommitmentTotal())}</button>
      </div>
      <h3>待付款/待处理</h3>
      ${renderCommitmentList()}
      <h3>押金和预授权</h3>
      ${renderHoldList()}
      <h3>最近消费订单</h3>
      ${renderRecordList(allMoneyRecords(8), "还没有消费订单。")}
      <h3>批量扣款记录</h3>
      ${renderBillRuns()}
      <h3>银行卡流水</h3>
      ${renderTransactions(8)}
    </section>
  `;
}

function renderWalletApp() {
  const selectedContact = contacts.find((contact) => contact.id === state.personTransferDraft.contactId) || contacts[0];
  return `
    ${appHeader("钱包", "转账、扫码和付款码")}
    <section class="app-body commerce-body">
      ${renderPaymentSummary()}
      <h3>扫码付款</h3>
      ${renderSpendList("wallet", "付款")}
      <h3>给人转账</h3>
      <div class="form-card transfer-card">
        <label>收款人</label>
        <select data-person-contact>
          ${contacts.map((contact) => `<option value="${contact.id}" ${selectedContact.id === contact.id ? "selected" : ""}>${contact.name} · ${contact.phone}</option>`).join("")}
        </select>
        <label>金额</label>
        <input data-person-amount type="number" min="1" step="1" value="${state.personTransferDraft.amount}" />
        <label>备注</label>
        <input data-person-note value="${escapeHtml(state.personTransferDraft.note)}" placeholder="餐费、房租、红包、垫付" />
        <button class="danger" data-transfer-person="true">确认转账</button>
        <p class="warning">转账会真实扣减银行卡余额，不能撤回。</p>
      </div>
      <div class="contact-grid">
        ${contacts
          .map(
            (contact) => `
              <article class="contact-card">
                <strong>${contact.name}</strong>
                <span>${contact.phone}</span>
                <p>${contact.note}</p>
                <div>
                  ${contact.presets.map((amount) => `<button data-quick-transfer="${contact.id}" data-quick-amount="${amount}">${money(amount)}</button>`).join("")}
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
      <h3>押金/预授权</h3>
      ${renderHoldList()}
      <h3>钱包支出记录</h3>
      ${renderRecordList(recordsForAny("wallet"), "还没有钱包支出记录。")}
      <h3>最近流水</h3>
      ${renderTransactions(6)}
    </section>
  `;
}

function renderFoodControlPanel() {
  const draft = currentFoodDraft();
  const address = foodAddressBook.find((entry) => entry.id === draft.addressId) || foodAddressBook[0];
  return `
    <section class="food-panel">
      <div class="food-address">
        <span>送达</span>
        <strong>${escapeHtml(address.label)} · ${escapeHtml(address.receiver)}</strong>
        <p>${escapeHtml(address.address)} · ${escapeHtml(address.phone)}</p>
      </div>
      <div class="food-segment" aria-label="收货地址">
        ${foodAddressBook
          .map(
            (item) => `
              <button data-food-option="addressId" data-food-value="${item.id}" aria-pressed="${draft.addressId === item.id ? "true" : "false"}">
                ${escapeHtml(item.label)}
              </button>
            `,
          )
          .join("")}
      </div>
      <div class="food-section">
        <span>配送</span>
        <div class="food-option-grid">
          ${foodDeliveryModes
            .map(
              (item) => `
                <button data-food-option="deliveryMode" data-food-value="${item.id}" aria-pressed="${draft.deliveryMode === item.id ? "true" : "false"}">
                  <strong>${escapeHtml(item.label)}</strong>
                  <small>${money(item.fee)} · ${escapeHtml(item.eta)}</small>
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="food-section">
        <span>优惠券</span>
        <div class="food-chip-row">
          ${foodCoupons
            .map(
              (item) => `
                <button data-food-option="couponId" data-food-value="${item.id}" aria-pressed="${draft.couponId === item.id ? "true" : "false"}">
                  ${escapeHtml(item.label)}
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="food-section">
        <span>骑手小费</span>
        <div class="food-chip-row">
          ${[0, 2, 5, 10]
            .map(
              (amount) => `
                <button data-food-option="riderTip" data-food-value="${amount}" aria-pressed="${draft.riderTip === amount ? "true" : "false"}">
                  ${amount ? money(amount) : "不加"}
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="food-toggles">
        <button data-food-option="tableware" data-food-value="${draft.tableware === "none" ? "need" : "none"}" aria-pressed="${draft.tableware !== "none" ? "true" : "false"}">餐具</button>
        <button data-food-toggle="privacyNumber" aria-pressed="${draft.privacyNumber ? "true" : "false"}">隐私号</button>
        <button data-food-toggle="invoice" aria-pressed="${draft.invoice ? "true" : "false"}">发票</button>
      </div>
      <textarea data-food-note maxlength="50" placeholder="口味、门牌、不要敲门">${escapeHtml(draft.note)}</textarea>
    </section>
  `;
}

function renderFoodSpendList() {
  const items = spendCatalogs.food || [];
  const activeTag = state.spendFilters?.food || "全部";
  const tags = ["全部", ...Array.from(new Set(items.map((item) => item.tag))).filter(Boolean)];
  const visibleItems = activeTag === "全部" ? items : items.filter((item) => item.tag === activeTag);
  return `
    <div class="spend-filter" aria-label="外卖分类筛选">
      ${tags
        .map(
          (tag) => `
            <button data-spend-filter-category="food" data-spend-filter-tag="${escapeHtml(tag)}" aria-pressed="${activeTag === tag ? "true" : "false"}">
              ${escapeHtml(tag)}
            </button>
          `,
        )
        .join("")}
    </div>
    <div class="spend-list food-spend-list">
      ${visibleItems
        .map((baseItem) => {
          const item = catalogItemForCheckout("food", baseItem);
          const food = item.foodBreakdown;
          return `
            <article class="spend-item food-spend-item">
              <div>
                <span class="spend-tag">${escapeHtml(baseItem.tag)}</span>
                <strong>${escapeHtml(baseItem.name)}</strong>
                <p>${escapeHtml(baseItem.desc)}</p>
                <small class="checkout-line">${escapeHtml(food ? `${food.deliveryLabel} · ${food.eta} · ${food.summary}` : checkoutLineFor("food", baseItem))}</small>
                ${renderSpendFlags(item)}
              </div>
              <div class="spend-action">
                <small>原价 ${money(baseItem.price)}</small>
                <b>${money(item.price)}</b>
                <button class="primary" data-spend-category="food" data-spend-id="${baseItem.id}">下单</button>
              </div>
            </article>
          `;
        })
        .join("")}
      ${visibleItems.length ? "" : `<p class="empty">这个分类下暂时没有可花钱项目。</p>`}
    </div>
  `;
}

function renderShopControlPanel() {
  const draft = currentShopDraft();
  const address = shopAddressBook.find((entry) => entry.id === draft.addressId) || shopAddressBook[0];
  const cartLines = shopCartLineItems();
  const cartBase = cartLines.reduce((sum, line) => sum + line.subtotal, 0);
  return `
    <section class="food-panel shop-panel">
      <div class="food-address shop-address">
        <span>默认收货</span>
        <strong>${escapeHtml(address.label)} · ${escapeHtml(address.receiver)} · ${escapeHtml(address.phone)}</strong>
        <p>${escapeHtml(address.address)}</p>
      </div>
      <div class="food-segment" aria-label="购物收货地址">
        ${shopAddressBook
          .map(
            (item) => `
              <button data-shop-option="addressId" data-shop-value="${item.id}" aria-pressed="${draft.addressId === item.id ? "true" : "false"}">
                ${escapeHtml(item.label)}
              </button>
            `,
          )
          .join("")}
      </div>
      <div class="food-section">
        <span>配送方式</span>
        <div class="food-option-grid">
          ${shopShippingModes
            .map(
              (item) => `
                <button data-shop-option="shippingMode" data-shop-value="${item.id}" aria-pressed="${draft.shippingMode === item.id ? "true" : "false"}">
                  <strong>${escapeHtml(item.label)} · ${money(item.fee)}</strong>
                  <small>${escapeHtml(item.eta)} · ${escapeHtml(item.promise)}</small>
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="food-section">
        <span>优惠券</span>
        <div class="food-chip-row">
          ${shopCoupons
            .map(
              (item) => `
                <button data-shop-option="couponId" data-shop-value="${item.id}" aria-pressed="${draft.couponId === item.id ? "true" : "false"}">
                  ${escapeHtml(item.label)}
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="food-toggles">
        <button data-shop-toggle="freightInsurance" aria-pressed="${draft.freightInsurance ? "true" : "false"}">运费险</button>
        <button data-shop-toggle="invoice" aria-pressed="${draft.invoice ? "true" : "false"}">发票</button>
        <button data-shop-toggle="giftWrap" aria-pressed="${draft.giftWrap ? "true" : "false"}">礼品包装</button>
      </div>
      <textarea data-shop-remark maxlength="60" placeholder="门牌、发票备注、送装时间">${escapeHtml(draft.remark)}</textarea>
      <div class="shop-cart">
        <div class="shop-cart-head">
          <div>
            <strong>购物车</strong>
            <span>${cartLines.length ? `${cartLines.reduce((sum, line) => sum + line.quantity, 0)} 件商品 · 原价 ${money(cartBase)}` : "还没有加购商品"}</span>
          </div>
          <button class="primary" data-shop-checkout-cart="true" ${cartLines.length ? "" : "disabled"}>结算购物车</button>
        </div>
        ${
          cartLines.length
            ? cartLines
                .map(
                  (line) => `
                    <div class="shop-cart-row">
                      <div>
                        <strong>${escapeHtml(line.name)}</strong>
                        <span>${escapeHtml(line.tag)} · ${money(line.price)} × ${line.quantity}</span>
                      </div>
                      <div class="shop-cart-actions">
                        <button data-shop-cart-qty="${line.id}" data-shop-cart-delta="-1" aria-label="减少">−</button>
                        <b>${line.quantity}</b>
                        <button data-shop-cart-qty="${line.id}" data-shop-cart-delta="1" aria-label="增加">＋</button>
                        <button data-shop-cart-remove="${line.id}">移除</button>
                      </div>
                    </div>
                  `,
                )
                .join("")
            : `<p class="empty">把想要的商品先加进购物车，再一次性确认扣款。</p>`
        }
      </div>
    </section>
  `;
}

function renderShopSpendList() {
  const items = spendCatalogs.shop || [];
  const activeTag = state.spendFilters?.shop || "全部";
  const tags = ["全部", ...Array.from(new Set(items.map((item) => item.tag))).filter(Boolean)];
  const visibleItems = activeTag === "全部" ? items : items.filter((item) => item.tag === activeTag);
  return `
    <div class="spend-filter" aria-label="购物分类筛选">
      ${tags
        .map(
          (tag) => `
            <button data-spend-filter-category="shop" data-spend-filter-tag="${escapeHtml(tag)}" aria-pressed="${activeTag === tag ? "true" : "false"}">
              ${escapeHtml(tag)}
            </button>
          `,
        )
        .join("")}
    </div>
    <div class="spend-list shop-spend-list">
      ${visibleItems
        .map((baseItem) => {
          const item = catalogItemForCheckout("shop", baseItem);
          const shop = item.shopBreakdown;
          const cartable = shopCartEligible(baseItem);
          return `
            <article class="spend-item shop-spend-item">
              <div>
                <span class="spend-tag">${escapeHtml(baseItem.tag)}</span>
                <strong>${escapeHtml(baseItem.name)}</strong>
                <p>${escapeHtml(baseItem.desc)}</p>
                <small class="checkout-line">${escapeHtml(shop ? `${shop.shippingLabel} · ${shop.eta} · ${shop.summary}` : checkoutLineFor("shop", baseItem))}</small>
                ${renderSpendFlags(item)}
              </div>
              <div class="spend-action">
                <small>标价 ${money(baseItem.price)}</small>
                <b>${money(item.price)}</b>
                <div class="shop-buy-actions">
                  ${cartable ? `<button data-shop-add-cart="${baseItem.id}">加车</button>` : ""}
                  <button class="primary" data-spend-category="shop" data-spend-id="${baseItem.id}">购买</button>
                </div>
              </div>
            </article>
          `;
        })
        .join("")}
      ${visibleItems.length ? "" : `<p class="empty">这个分类下暂时没有可花钱项目。</p>`}
    </div>
  `;
}

function renderTravelControlPanel() {
  const draft = currentTravelDraft();
  const passenger = travelPassengers.find((entry) => entry.id === draft.passengerId) || travelPassengers[0];
  return `
    <section class="food-panel travel-panel">
      <div class="food-address travel-address">
        <span>实名出行</span>
        <strong>${escapeHtml(passenger.name)} · ${escapeHtml(passenger.label)}</strong>
        <p>${escapeHtml(passenger.cert)} · ${escapeHtml(passenger.phone)} · ${escapeHtml(passenger.note)}</p>
      </div>
      <div class="food-segment" aria-label="出行人">
        ${travelPassengers
          .map(
            (item) => `
              <button data-travel-option="passengerId" data-travel-value="${item.id}" aria-pressed="${draft.passengerId === item.id ? "true" : "false"}">
                ${escapeHtml(item.label)}
              </button>
            `,
          )
          .join("")}
      </div>
      <div class="food-section">
        <span>日期/库存</span>
        <div class="food-option-grid">
          ${travelDateSlots
            .map(
              (item) => `
                <button data-travel-option="dateSlot" data-travel-value="${item.id}" aria-pressed="${draft.dateSlot === item.id ? "true" : "false"}">
                  <strong>${escapeHtml(item.label)}</strong>
                  <small>${item.feeRate ? `+${Math.round(item.feeRate * 100)}%` : "不加价"} · ${escapeHtml(item.desc)}</small>
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="food-section">
        <span>规格/选座/房型</span>
        <div class="food-option-grid">
          ${travelServiceLevels
            .map(
              (item) => `
                <button data-travel-option="serviceLevel" data-travel-value="${item.id}" aria-pressed="${draft.serviceLevel === item.id ? "true" : "false"}">
                  <strong>${escapeHtml(item.label)} · ${money(item.fee)}</strong>
                  <small>${escapeHtml(item.desc)}</small>
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="food-section">
        <span>行李</span>
        <div class="food-chip-row">
          ${travelBaggageOptions
            .map(
              (item) => `
                <button data-travel-option="baggage" data-travel-value="${item.id}" aria-pressed="${draft.baggage === item.id ? "true" : "false"}">
                  ${escapeHtml(item.label)}${item.fee ? ` ${money(item.fee)}` : ""}
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="food-section">
        <span>退改规则</span>
        <div class="food-option-grid">
          ${travelRefundRules
            .map(
              (item) => `
                <button data-travel-option="refundRule" data-travel-value="${item.id}" aria-pressed="${draft.refundRule === item.id ? "true" : "false"}">
                  <strong>${escapeHtml(item.label)}</strong>
                  <small>${item.feeRate ? `+${Math.round(item.feeRate * 100)}%` : "不加价"} · 约退 ${Math.round(item.refundRate * 100)}%</small>
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="food-section">
        <span>出行券</span>
        <div class="food-chip-row">
          ${travelCoupons
            .map(
              (item) => `
                <button data-travel-option="couponId" data-travel-value="${item.id}" aria-pressed="${draft.couponId === item.id ? "true" : "false"}">
                  ${escapeHtml(item.label)}
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="food-toggles">
        <button data-travel-toggle="insurance" aria-pressed="${draft.insurance ? "true" : "false"}">出行保障</button>
        <button data-travel-toggle="autoCheckIn" aria-pressed="${draft.autoCheckIn ? "true" : "false"}">值机/入住助手</button>
        <button data-travel-toggle="invoice" aria-pressed="${draft.invoice ? "true" : "false"}">发票</button>
      </div>
      <textarea data-travel-remark maxlength="60" placeholder="座位、到店时间、航班偏好、发票备注">${escapeHtml(draft.remark)}</textarea>
    </section>
  `;
}

function renderTravelSpendList() {
  const items = spendCatalogs.travel || [];
  const activeTag = state.spendFilters?.travel || "全部";
  const tags = ["全部", ...Array.from(new Set(items.map((item) => item.tag))).filter(Boolean)];
  const visibleItems = activeTag === "全部" ? items : items.filter((item) => item.tag === activeTag);
  return `
    <div class="spend-filter" aria-label="旅行分类筛选">
      ${tags
        .map(
          (tag) => `
            <button data-spend-filter-category="travel" data-spend-filter-tag="${escapeHtml(tag)}" aria-pressed="${activeTag === tag ? "true" : "false"}">
              ${escapeHtml(tag)}
            </button>
          `,
        )
        .join("")}
    </div>
    <div class="spend-list travel-spend-list">
      ${visibleItems
        .map((baseItem) => {
          const item = catalogItemForCheckout("travel", baseItem);
          const travel = item.travelBreakdown;
          return `
            <article class="spend-item travel-spend-item">
              <div>
                <span class="spend-tag">${escapeHtml(baseItem.tag)}</span>
                <strong>${escapeHtml(baseItem.name)}</strong>
                <p>${escapeHtml(baseItem.desc)}</p>
                <small class="checkout-line">${escapeHtml(travel ? `${travel.route} · ${travel.summary} · ${travel.returnRule}` : checkoutLineFor("travel", baseItem))}</small>
                ${renderSpendFlags(item)}
              </div>
              <div class="spend-action">
                <small>标价 ${money(baseItem.price)}</small>
                <b>${money(item.price)}</b>
                <button class="primary" data-spend-category="travel" data-spend-id="${baseItem.id}">预订</button>
              </div>
            </article>
          `;
        })
        .join("")}
      ${visibleItems.length ? "" : `<p class="empty">这个分类下暂时没有可花钱项目。</p>`}
    </div>
  `;
}

function renderTravelAfterSales() {
  const bookings = state.bookings.filter((booking) => booking.category === "travel").slice(0, 5);
  if (!bookings.length) return `<p class="empty">预订旅行后可以在这里值机、入住或退订。</p>`;
  return bookings
    .map((booking) => {
      const travel = booking.travelBreakdown || {};
      const refundable = Math.max(1, Math.floor(booking.amount * (Number(travel.refundRate) || Number(booking.refundRate) || 0.82)));
      const checkInDone = Boolean(booking.checkInStatus);
      return `
        <div class="list-row refund-row travel-action-row">
          <div>
            <strong>${escapeHtml(booking.title)}</strong>
            <span>${escapeHtml(booking.status)} · ${money(booking.amount)}</span>
            <small class="record-meta">${escapeHtml(travel.fulfillmentLabel || "行程确认")} · ${escapeHtml(travel.returnRule || "退订按平台规则扣费")} · 预计可退 ${money(refundable)}</small>
          </div>
          <div class="travel-action-buttons">
            <button data-travel-checkin="${booking.id}" ${checkInDone ? "disabled" : ""}>${checkInDone ? "已确认" : "值机/入住"}</button>
            <button data-refund-booking="${booking.id}" ${booking.refundStatus ? "disabled" : ""}>${booking.refundStatus || "退订"}</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderFoodApp() {
  return `
    ${appHeader("外卖", "点餐、买菜、跑腿和会员")}
    <section class="app-body commerce-body">
      ${renderPaymentSummary()}
      ${renderFoodControlPanel()}
      <h3>可下单</h3>
      ${renderFoodSpendList()}
      <h3>最近外卖</h3>
      ${renderRecordList(recordsFor("food"), "还没有外卖订单。")}
    </section>
  `;
}

function renderShopApp() {
  const refundableOrders = recordsFor("shop").slice(0, 4);
  return `
    ${appHeader("购物", "购物车、配送、售后和物流")}
    <section class="app-body commerce-body">
      ${renderPaymentSummary()}
      ${renderShopControlPanel()}
      <h3>今日推荐</h3>
      ${renderShopSpendList()}
      <h3>最近订单</h3>
      ${renderRecordList(recordsFor("shop"), "还没有购物订单。")}
      <h3>售后退款</h3>
      ${
        refundableOrders.length
          ? refundableOrders
              .map(
                (order) => `
                  <div class="list-row refund-row">
                    <div>
                      <strong>${escapeHtml(order.title)}</strong>
                      <span>${escapeHtml(order.status)} · ${money(order.amount)}</span>
                      <small class="record-meta">${escapeHtml(order.shopBreakdown?.returnRule || "按平台售后规则扣除服务费后退款")} · 预计退 ${money(Math.max(1, Math.floor(order.amount * (order.shopBreakdown?.refundRate || 0.92))))}</small>
                    </div>
                    <button data-refund-order="${order.id}" ${order.refundStatus ? "disabled" : ""}>${order.refundStatus || "申请退款"}</button>
                  </div>
                `,
              )
              .join("")
          : `<p class="empty">购物后可以在这里申请售后。</p>`
      }
      ${renderRefundList()}
    </section>
  `;
}

function renderTravelApp() {
  return `
    ${appHeader("旅行", "出行人、行李、退改、值机和售后")}
    <section class="app-body commerce-body">
      ${renderPaymentSummary()}
      ${renderTravelControlPanel()}
      <h3>可预订</h3>
      ${renderTravelSpendList()}
      <h3>行程订单</h3>
      ${renderRecordList(state.bookings.filter((booking) => booking.category === "travel"), "还没有旅行订单。")}
      <h3>值机/入住与退订</h3>
      ${renderTravelAfterSales()}
      <h3>押金/预授权</h3>
      ${renderHoldList("travel")}
      <h3>售后退款</h3>
      ${renderRefundList()}
    </section>
  `;
}

function renderCarsApp() {
  return `
    ${appHeader("汽车", "买车和养车支出")}
    <section class="app-body commerce-body">
      ${renderPaymentSummary()}
      <h3>车辆服务</h3>
      ${renderSpendList("cars", "支付")}
      <h3>我的车辆</h3>
      ${renderAssetList(state.assets.vehicles, "还没有车辆资产。")}
      <h3>车贷/月供</h3>
      ${renderLoanList("cars")}
      <h3>用车账单</h3>
      ${renderRecordList(serviceRecordsFor("cars"), "还没有用车账单。")}
    </section>
  `;
}

function renderPropertyApp() {
  return `
    ${appHeader("房产", "租房、买房、物业和装修")}
    <section class="app-body commerce-body">
      ${renderPaymentSummary()}
      <h3>房产支出</h3>
      ${renderSpendList("property", "支付")}
      <h3>我的房产/租约</h3>
      ${renderAssetList(state.assets.properties, "还没有房产或租约记录。")}
      <h3>房贷/月供</h3>
      ${renderLoanList("property")}
      <h3>房产账单</h3>
      ${renderRecordList(serviceRecordsFor("property"), "还没有房产账单。")}
    </section>
  `;
}

function renderServicesApp() {
  return `
    ${appHeader("缴费", "生活缴费、医疗、教育和公益")}
    <section class="app-body commerce-body">
      ${renderPaymentSummary()}
      <h3>常用缴费</h3>
      ${renderSpendList("services", "缴费")}
      <h3>缴费记录</h3>
      ${renderRecordList(serviceRecordsFor("services"), "还没有缴费记录。")}
    </section>
  `;
}

function renderEntertainmentApp() {
  return `
    ${appHeader("娱乐", "电影、演出、游戏和会员")}
    <section class="app-body commerce-body">
      ${renderPaymentSummary()}
      <h3>娱乐消费</h3>
      ${renderSpendList("entertainment", "购买")}
      <h3>娱乐订单</h3>
      ${renderRecordList(recordsFor("entertainment"), "还没有娱乐订单。")}
    </section>
  `;
}

function renderStocksApp() {
  return `
    ${appHeader("炒股", "股票、基金、黄金和理财")}
    <section class="app-body commerce-body">
      ${renderPaymentSummary()}
      <h3>可买入</h3>
      ${renderSpendList("stocks", "买入")}
      <h3>持仓</h3>
      ${renderAssetList(state.assets.holdings, "还没有任何持仓。")}
      <p class="warning">这里是模拟交易，扣款真实发生在游戏银行卡余额里。</p>
    </section>
  `;
}

function renderRideApp() {
  return renderCommerceCategoryApp({
    appId: "ride",
    title: "出行",
    subtitle: "打车、骑行、ETC 和接送机",
    listTitle: "可用出行服务",
    buttonText: "叫车/支付",
    recordTitle: "出行账单",
    emptyText: "还没有出行账单。",
  });
}

function renderLocalApp() {
  return renderCommerceCategoryApp({
    appId: "local",
    title: "本地生活",
    subtitle: "保洁、搬家、维修和到店消费",
    listTitle: "附近服务",
    buttonText: "预约",
    recordTitle: "服务记录",
    emptyText: "还没有本地生活服务记录。",
  });
}

function renderHealthApp() {
  return renderCommerceCategoryApp({
    appId: "health",
    title: "医疗",
    subtitle: "问诊、买药、体检和牙科",
    listTitle: "医疗服务",
    buttonText: "支付",
    recordTitle: "医疗订单",
    emptyText: "还没有医疗支出。",
  });
}

function renderInsuranceApp() {
  return `
    ${appHeader("保险", "保费、保单和保障记录")}
    <section class="app-body commerce-body">
      ${renderPaymentSummary()}
      <h3>保险产品</h3>
      ${renderSpendList("insurance", "投保")}
      <h3>我的保单</h3>
      ${renderAssetList(state.assets.policies, "还没有保单。")}
      <h3>保费记录</h3>
      ${renderRecordList(recordsForAny("insurance"), "还没有保费支出。")}
    </section>
  `;
}

function renderCreditApp() {
  const enabled = state.credit.enabled;
  const used = Math.floor(Number(state.credit.used) || 0);
  const available = creditAvailable();
  const minRepay = Math.min(used, Math.max(100, Math.ceil(used * 0.1)));
  return `
    ${appHeader("信用", enabled ? "额度、借款、分期和还款" : "先开通，再先用后付")}
    <section class="app-body commerce-body credit-body">
      <div class="credit-summary">
        <span>${enabled ? "可用额度" : "信用账户未开通"}</span>
        <strong>${enabled ? money(available) : money(state.credit.limit)}</strong>
        <small>${enabled ? `已用 ${money(used)} / 总额度 ${money(state.credit.limit)}` : "需要手机号和至少一张银行卡，开通后会生成信用账单。"}</small>
      </div>
      ${
        enabled
          ? `
            <div class="credit-actions">
              <button class="primary" data-credit-loan="1000">借 ¥1,000 到银行卡</button>
              <button class="primary" data-credit-loan="5000">借 ¥5,000 到银行卡</button>
              <button class="danger" data-credit-repay="${minRepay}" ${used ? "" : "disabled"}>还最低 ${money(minRepay)}</button>
              <button data-credit-repay="${used}" ${used ? "" : "disabled"}>全额还款 ${money(used)}</button>
            </div>
          `
          : `<button class="primary" data-credit-activate="true" ${hasActivePlan() && state.cards.length ? "" : "disabled"}>开通信用账户</button>`
      }
      ${!hasActivePlan() || !state.cards.length ? `<p class="warning">信用账户需要有效套餐和银行卡。先去营业厅和 XX银行。</p>` : ""}
      <h3>信用消费</h3>
      ${renderSpendList("credit", "用额度")}
      <h3>分期记录</h3>
      ${renderInstallments()}
      <h3>信用账单</h3>
      ${renderCreditBills()}
    </section>
  `;
}

function renderSubscriptionsApp() {
  return `
    ${appHeader("订阅", "会员、云服务和自动续费")}
    <section class="app-body commerce-body">
      ${renderPaymentSummary()}
      <h3>可开通订阅</h3>
      ${renderSpendList("subscriptions", "开通")}
      <h3>我的订阅</h3>
      ${renderSubscriptionList()}
      <h3>扣费记录</h3>
      ${renderRecordList(recordsForAny("subscriptions"), "还没有订阅扣费。")}
    </section>
  `;
}

function renderLogisticsApp() {
  return `
    ${appHeader("快递", "寄件、保价、退货、地图和驿站")}
    <section class="app-body commerce-body logistics-body">
      ${renderPaymentSummary()}
      ${renderLogisticsWorldMap()}
      <h3>我的包裹 / MoneyOS驿站</h3>
      ${renderShipmentList()}
      <h3>可下单服务</h3>
      ${renderSpendList("logistics", "寄件")}
      <h3>物流账单</h3>
      ${renderRecordList(recordsForAny("logistics"), "还没有快递账单。")}
    </section>
  `;
}

function renderSecondhandApp() {
  return renderCommerceCategoryApp({
    appId: "secondhand",
    title: "闲置",
    subtitle: "担保交易、验机和保证金",
    listTitle: "可购买/冻结",
    buttonText: "支付",
    recordTitle: "交易记录",
    emptyText: "还没有二手交易。",
  });
}

function renderGovApp() {
  return renderCommerceCategoryApp({
    appId: "gov",
    title: "政务",
    subtitle: "罚款、税费、证照和公共服务",
    listTitle: "可办理缴费",
    buttonText: "缴费",
    recordTitle: "办理记录",
    emptyText: "还没有政务缴费。",
  });
}

function renderEducationApp() {
  return renderCommerceCategoryApp({
    appId: "education",
    title: "教育",
    subtitle: "学费、考试、家教和证书",
    listTitle: "教育支出",
    buttonText: "缴费",
    recordTitle: "教育账单",
    emptyText: "还没有教育支出。",
  });
}

function renderBeautyApp() {
  return renderCommerceCategoryApp({
    appId: "beauty",
    title: "美业",
    subtitle: "美发、美甲、美容和医美",
    listTitle: "可预约项目",
    buttonText: "预约",
    recordTitle: "美业订单",
    emptyText: "还没有美业消费。",
  });
}

function renderPetsApp() {
  return renderCommerceCategoryApp({
    appId: "pets",
    title: "宠物",
    subtitle: "宠物粮、洗护、医疗和保险",
    listTitle: "宠物服务",
    buttonText: "支付",
    recordTitle: "宠物账单",
    emptyText: "还没有宠物支出。",
  });
}

function renderRechargeApp() {
  return renderCommerceCategoryApp({
    appId: "recharge",
    title: "充值",
    subtitle: "游戏、礼品卡、打赏和数字内容",
    listTitle: "可充值项目",
    buttonText: "充值",
    recordTitle: "充值记录",
    emptyText: "还没有充值记录。",
  });
}

function renderSocialApp() {
  return renderCommerceCategoryApp({
    appId: "social",
    title: "社交",
    subtitle: "红包、礼物、会员和付费社群",
    listTitle: "社交消费",
    buttonText: "支付",
    recordTitle: "社交账单",
    emptyText: "还没有社交消费。",
  });
}

function renderRentalApp() {
  return `
    ${appHeader("租赁", "数码、服装、工具、共享设备和押金")}
    <section class="app-body commerce-body">
      ${renderPaymentSummary()}
      <h3>可租赁项目</h3>
      ${renderSpendList("rental", "租用")}
      <h3>租赁押金/预授权</h3>
      ${renderHoldList("rental")}
      <h3>租赁账单</h3>
      ${renderRecordList(recordsForAny("rental"), "还没有租赁账单。")}
    </section>
  `;
}

function renderOfficeApp() {
  return renderCommerceCategoryApp({
    appId: "office",
    title: "办公",
    subtitle: "云服务、SaaS、签章和会议室",
    listTitle: "办公支出",
    buttonText: "支付",
    recordTitle: "办公账单",
    emptyText: "还没有办公支出。",
  });
}

function renderRenovationApp() {
  return `
    ${appHeader("家装", "设计、建材、家电、安装和装修贷")}
    <section class="app-body commerce-body">
      ${renderPaymentSummary()}
      <h3>家装项目</h3>
      ${renderSpendList("renovation", "支付")}
      <h3>装修贷/月供</h3>
      ${renderLoanList("renovation")}
      <h3>家装账单</h3>
      ${renderRecordList(recordsForAny("renovation"), "还没有家装账单。")}
    </section>
  `;
}

function renderParentingApp() {
  return `
    ${appHeader("母婴", "奶粉尿裤、托育、早教和儿童保障")}
    <section class="app-body commerce-body">
      ${renderPaymentSummary()}
      <h3>母婴支出</h3>
      ${renderSpendList("parenting", "支付")}
      <h3>儿童保单</h3>
      ${renderAssetList(state.assets.policies.filter((policy) => policy.name.includes("少儿") || policy.name.includes("儿童")), "还没有儿童保单。")}
      <h3>母婴账单</h3>
      ${renderRecordList(recordsForAny("parenting"), "还没有母婴支出。")}
    </section>
  `;
}

function renderTicketsApp() {
  return renderCommerceCategoryApp({
    appId: "tickets",
    title: "票务",
    subtitle: "演出、体育、展览、电影和退改签",
    listTitle: "可购票/服务",
    buttonText: "购票",
    recordTitle: "票务订单",
    emptyText: "还没有票务订单。",
  });
}

function renderOverseasApp() {
  return renderCommerceCategoryApp({
    appId: "overseas",
    title: "跨境",
    subtitle: "海淘、签证、汇款和外币手续费",
    listTitle: "跨境消费",
    buttonText: "支付",
    recordTitle: "跨境记录",
    emptyText: "还没有跨境支出。",
  });
}

function renderLegalApp() {
  return renderCommerceCategoryApp({
    appId: "legal",
    title: "法律",
    subtitle: "律师、公证、诉讼和仲裁",
    listTitle: "法律服务",
    buttonText: "办理",
    recordTitle: "法律账单",
    emptyText: "还没有法律服务支出。",
  });
}

function renderJobsApp() {
  return renderCommerceCategoryApp({
    appId: "jobs",
    title: "求职",
    subtitle: "简历、会员、背调和猎头",
    listTitle: "求职服务",
    buttonText: "购买",
    recordTitle: "求职账单",
    emptyText: "还没有求职支出。",
  });
}

function renderEventsApp() {
  return renderCommerceCategoryApp({
    appId: "events",
    title: "活动",
    subtitle: "婚礼、会务、派对和团建",
    listTitle: "活动服务",
    buttonText: "预订",
    recordTitle: "活动账单",
    emptyText: "还没有活动支出。",
  });
}

function renderSecurityApp() {
  return `
    ${appHeader("安防", "设备、云存储、隐私和押金")}
    <section class="app-body commerce-body">
      ${renderPaymentSummary()}
      <h3>安防服务</h3>
      ${renderSpendList("security", "支付")}
      <h3>押金/预授权</h3>
      ${renderHoldList("security")}
      <h3>安防账单</h3>
      ${renderRecordList(recordsForAny("security"), "还没有安防支出。")}
    </section>
  `;
}

function renderSimpleDownloadedApp(title, text) {
  return `
    ${appHeader(title, "已下载")}
    <section class="app-body">
      <div class="empty-app">
        <strong>${title}</strong>
        <p>${text}</p>
        <button data-home="true">先回去数钱</button>
      </div>
    </section>
  `;
}

function renderCards() {
  if (!state.cards.length) return `<p class="empty">还没有银行卡。</p>`;
  return state.cards
    .map(
      (card) => `
        <article class="bank-card ${card.id === state.defaultCardId ? "default-card" : ""}">
          <span>${card.name}${card.id === state.defaultCardId ? " · 默认支付卡" : ""}</span>
          <strong>${formatCard(card.number)}</strong>
          <b>${money(card.balance)}</b>
          <button class="${tutorialTargetClass("copyCard")}" data-copy-card="${card.number}">复制卡号</button>
          <button data-default-card="${card.id}" ${card.id === state.defaultCardId ? "disabled" : ""}>${card.id === state.defaultCardId ? "默认卡" : "设为默认"}</button>
        </article>
      `,
    )
    .join("");
}

function renderCalls() {
  if (!state.calls.length) return `<p class="empty">暂无通话记录。</p>`;
  return state.calls
    .slice(0, 10)
    .map(
      (call) => `
        <div class="list-row">
          <div><strong>${escapeHtml(call.number)}</strong><span>${escapeHtml(call.time)} · ${escapeHtml(call.type)}</span></div>
          <b>${escapeHtml(call.result)}</b>
        </div>
      `,
    )
    .join("");
}

function renderMessages() {
  return state.messages
    .slice(0, 12)
    .map(
      (message) => `
        <div class="message ${message.from === "我" ? "mine" : ""}">
          <span>${escapeHtml(message.from)} → ${escapeHtml(message.to)} · ${escapeHtml(message.time)}</span>
          <p>${escapeHtml(message.text)}</p>
        </div>
      `,
    )
    .join("");
}

function tutorialActive() {
  return Boolean(state.tutorial && !state.tutorial.done);
}

function currentTutorialStep() {
  return state.tutorial?.step || "openCash";
}

function setTutorialStep(step) {
  if (!state.tutorial) state.tutorial = structuredClone(defaultState.tutorial);
  state.tutorial.step = step;
  state.tutorial.updatedAt = Date.now();
}

function normalizeTutorialProgress() {
  if (!tutorialActive()) return;
  if (!state.tutorial.callLogged) {
    state.calls.unshift({ id: makeId(), number: "神秘电话", type: "呼入", result: "教程中", time: nowTime() });
    state.tutorial.callLogged = true;
  }

  const step = currentTutorialStep();
  if (step === "countCash" && state.cashBalance >= TUTORIAL_CASH_GOAL) setTutorialStep("openStoreCarrier");
  if (step === "openStoreCarrier" && state.activeApp === "store") setTutorialStep("downloadCarrier");
  if (step === "downloadCarrier" && state.installed.includes("carrier")) setTutorialStep("openCarrier");
  if (step === "openCarrier" && state.activeApp === "carrier") setTutorialStep("buyNumber");
  if (step === "buyNumber" && state.phoneNumber) setTutorialStep("buyPlan");
  if (step === "buyPlan" && hasActivePlan()) setTutorialStep("openStoreBank");
  if (step === "openStoreBank" && state.activeApp === "store") setTutorialStep("downloadBank");
  if (step === "downloadBank" && state.installed.includes("bank")) setTutorialStep("openBank");
  if (step === "openBank" && state.activeApp === "bank") setTutorialStep("newCard");
  if (step === "pasteCard" && cardByNumber(state.transferDraft.cardNumber)) setTutorialStep("transfer");
  if (step === "done") scheduleTutorialHangup();
}

function tutorialMessage() {
  const step = currentTutorialStep();
  const left = Math.max(0, TUTORIAL_CASH_GOAL - state.cashBalance);
  if (step === "openCash") return "你好兄弟，祝贺你获得不劳而获的资格。现在打开这个app。";
  if (step === "countCash") {
    return left > 0
      ? `开始数钱吧兄弟，数多少得多少，越勤劳越富有。点一张得一张，童叟无欺。先数到 ${money(TUTORIAL_CASH_GOAL)}，还差 ${money(left)}。`
      : "可以了。记住：点钞余额不能直接花，钱要先进银行。现在去应用商店。";
  }
  if (step === "openStoreCarrier") return "现在去应用商店，先下载营业厅。没有手机号，银行会装作不认识你。";
  if (step === "downloadCarrier") return "下载营业厅。你需要一个手机号，哪怕它只是一个看起来很正式的数字。";
  if (step === "openCarrier") return "营业厅装好了，打开它，注册一个手机号。";
  if (step === "buyNumber") return `购买手机号。系统会自动从点钞余额扣 ${money(FIRST_NUMBER_TOP_UP)} 充话费，这是唯一一次点钞余额能直接被拿走。`;
  if (step === "buyPlan") return "现在办理 19 元不够用套餐。没有套餐，手机就是一块会发光的砖。";
  if (step === "openStoreBank") return "现在回应用商店，下载 XX银行。钱要从点钞软件里搬到银行卡。";
  if (step === "downloadBank") return "下载 XX银行。这个图标越正经，事情越离谱。";
  if (step === "openBank") return "打开 XX银行，办理一张银行卡。";
  if (step === "newCard") return "用刚买的手机号办理银行卡。";
  if (step === "copyCard") return "复制你的银行卡号。别手输，输错钱就真的没了。";
  if (step === "pasteCard") return "把银行卡号粘贴到转账框里。";
  if (step === "transfer") return "确认转账，把点钞 App 里的钱转到银行卡。";
  if (step === "done") return "祝你好运，再见。";
  return "按圈出来的地方操作。";
}

function renderTutorialOverlay() {
  if (!tutorialActive()) return "";
  return `
    <aside class="tutorial-call" aria-live="assertive">
      <span class="tutorial-call-icon">☎</span>
      <div>
        <strong>神秘电话</strong>
        <p>${tutorialMessage()}</p>
      </div>
    </aside>
  `;
}

function tutorialIsTarget(action, value = "") {
  if (!tutorialActive()) return false;
  const step = currentTutorialStep();
  if (step === "openCash") return action === "open" && value === "cash";
  if (step === "countCash") return action === "cashSwipe";
  if (step === "openStoreCarrier" || step === "openStoreBank") return action === "open" && value === "store";
  if (step === "downloadCarrier") return action === "download" && value === "carrier";
  if (step === "openCarrier") return action === "open" && value === "carrier";
  if (step === "buyNumber") return action === "buyNumber";
  if (step === "buyPlan") return action === "buyPlan" && value === "basic";
  if (step === "downloadBank") return action === "download" && value === "bank";
  if (step === "openBank") return action === "open" && value === "bank";
  if (step === "newCard") return action === "newCard";
  if (step === "copyCard") return action === "copyCard";
  if (step === "pasteCard") return action === "pasteCard";
  if (step === "transfer") return action === "transferToCard";
  return false;
}

function tutorialTargetClass(action, value = "") {
  return tutorialIsTarget(action, value) ? "tutorial-target" : "";
}

function tutorialAllows(action, value = "") {
  if (!tutorialActive()) return true;
  const step = currentTutorialStep();
  if (tutorialIsTarget(action, value)) return true;
  if ((step === "openStoreCarrier" || step === "openStoreBank" || step === "openCarrier" || step === "openBank") && action === "home") return true;
  if (step === "transfer" && action === "input") return true;
  return false;
}

function nudgeTutorial() {
  const call = document.querySelector(".tutorial-call");
  if (!call) return;
  call.classList.remove("nudge");
  void call.offsetWidth;
  call.classList.add("nudge");
}

function guardTutorialAction(action, value = "", event) {
  if (tutorialAllows(action, value)) return true;
  if (event) event.preventDefault();
  nudgeTutorial();
  return false;
}

function advanceTutorial(action, value = "") {
  if (!tutorialActive()) return;
  const step = currentTutorialStep();
  if (step === "openCash" && action === "open" && value === "cash") setTutorialStep("countCash");
  if (step === "countCash" && action === "cashCounted" && state.cashBalance >= TUTORIAL_CASH_GOAL) setTutorialStep("openStoreCarrier");
  if (step === "openStoreCarrier" && action === "open" && value === "store") setTutorialStep("downloadCarrier");
  if (step === "downloadCarrier" && action === "download" && value === "carrier") {
    setTutorialStep("openCarrier");
    state.activeApp = "home";
  }
  if (step === "openCarrier" && action === "open" && value === "carrier") setTutorialStep("buyNumber");
  if (step === "buyNumber" && action === "buyNumber") setTutorialStep("buyPlan");
  if (step === "buyPlan" && action === "buyPlan") {
    setTutorialStep("openStoreBank");
    state.activeApp = "home";
  }
  if (step === "openStoreBank" && action === "open" && value === "store") setTutorialStep("downloadBank");
  if (step === "downloadBank" && action === "download" && value === "bank") {
    setTutorialStep("openBank");
    state.activeApp = "home";
  }
  if (step === "openBank" && action === "open" && value === "bank") setTutorialStep("newCard");
  if (step === "newCard" && action === "newCard") setTutorialStep("copyCard");
  if (step === "copyCard" && action === "copyCard") setTutorialStep("pasteCard");
  if (step === "pasteCard" && action === "pasteCard") setTutorialStep("transfer");
  if (step === "transfer" && action === "transferToCard") {
    setTutorialStep("done");
    scheduleTutorialHangup();
  }
}

function scheduleTutorialHangup() {
  if (tutorialHangupTimer || !tutorialActive() || currentTutorialStep() !== "done") return;
  tutorialHangupTimer = window.setTimeout(() => {
    state.tutorial.done = true;
    state.calls.unshift({ id: makeId(), number: "神秘电话", type: "呼入", result: "已挂断", time: nowTime() });
    saveState();
    render();
  }, 1700);
}

function syncTutorialChrome() {
  el.homeButton.classList.remove("tutorial-target");
  el.backButton.classList.remove("tutorial-target");
  el.taskButton.classList.remove("tutorial-target");
  if (!tutorialActive()) return;
  if (tutorialIsTarget("open", "store") && state.activeApp !== "home") el.taskButton.classList.add("tutorial-target");
}

function scrollTargetIntoView(target) {
  const scroller = target.closest(".app-body, .home-wallpaper, .checkout-scroll");
  if (!scroller) {
    target.scrollIntoView({ block: "center", inline: "nearest" });
    return;
  }
  const targetRect = target.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const targetCenter = targetRect.top + targetRect.height / 2;
  const scrollerCenter = scrollerRect.top + scrollerRect.height / 2;
  scroller.scrollTop += targetCenter - scrollerCenter;
  scroller.scrollLeft += Math.max(0, targetRect.right - scrollerRect.right + 12);
  scroller.scrollLeft -= Math.max(0, scrollerRect.left - targetRect.left + 12);
}

function syncTutorialScroll() {
  if (!tutorialActive()) return;
  const target = el.screen.querySelector(".tutorial-target");
  if (target) {
    scrollTargetIntoView(target);
    return;
  }
  if (!["pasteCard", "transfer"].includes(currentTutorialStep())) return;
  const body = el.screen.querySelector(".bank-body");
  if (body) body.scrollTop = body.scrollHeight;
}

function countBill(options = {}) {
  state.cashBalance += BILL_VALUE;
  state.stats.countedBills += 1;
  addNotice(`点钞 +${money(BILL_VALUE)}`);
  advanceTutorial("cashCounted");
  if (options.render === false) {
    const balance = el.screen.querySelector(".cash-total strong");
    if (balance) balance.textContent = money(state.cashBalance);
    saveState();
    return;
  }
  render();
}

function setCashDrag(dx, dy) {
  const zone = el.screen.querySelector("[data-cash-swipe]");
  if (!zone) return;
  cashSwipe.dx = Math.max(-80, Math.min(80, dx));
  cashSwipe.dy = Math.max(-210, Math.min(46, dy));
  const progress = Math.max(0, Math.min(1, -cashSwipe.dy / 150));
  const press = Math.max(0, Math.min(12, progress * 12));
  const rotate = Math.max(-24, Math.min(12, -4 + cashSwipe.dx * 0.04 + cashSwipe.dy * 0.075));
  zone.style.setProperty("--cash-drag-x", `${cashSwipe.dx}px`);
  zone.style.setProperty("--cash-drag-y", `${cashSwipe.dy}px`);
  zone.style.setProperty("--cash-rotate", `${rotate}deg`);
  zone.style.setProperty("--cash-progress", progress.toFixed(3));
  zone.style.setProperty("--stack-press", `${press}px`);
  zone.style.setProperty("--stack-press-mid", `${press * 0.65}px`);
  zone.style.setProperty("--stack-press-top", `${press * 0.35}px`);
  zone.style.setProperty("--top-brightness", (1 - progress * 0.04).toFixed(3));
  zone.style.setProperty("--top-rotate", `${1 - progress}deg`);
  zone.style.setProperty("--thumb-scale", (0.86 + progress * 0.16).toFixed(3));
  zone.style.setProperty("--bill-edge-opacity", (0.2 + progress * 0.5).toFixed(3));
  zone.style.setProperty("--slot-scale", (1 + progress * 0.08).toFixed(3));
  zone.style.setProperty("--thumb-x", `${cashSwipe.dx * 0.35}px`);
  zone.style.setProperty("--thumb-y", `${Math.max(-120, cashSwipe.dy * 0.58)}px`);
}

function resetCashSwipe(delay = 0) {
  window.setTimeout(() => {
    const zone = el.screen.querySelector("[data-cash-swipe]");
    if (!zone) return;
    zone.classList.remove("dragging", "counted", "snapback");
    setCashDrag(0, 0);
  }, delay);
}

function beginCashSwipe(event) {
  const zone = event.target.closest("[data-cash-swipe]");
  if (!zone || state.activeApp !== "cash") return false;
  if (!guardTutorialAction("cashSwipe", "", event)) return false;
  if (cashSwipe.active) return false;
  cashSwipe.active = true;
  cashSwipe.committed = false;
  cashSwipe.pointerId = event.pointerId ?? "mouse";
  cashSwipe.startX = event.clientX;
  cashSwipe.startY = event.clientY;
  cashSwipe.startTime = performance.now();
  const rect = zone.getBoundingClientRect();
  cashSwipe.startLow = event.clientY > rect.top + rect.height * 0.55;
  zone.classList.remove("counted", "snapback");
  zone.classList.add("dragging");
  cashSwipe.maxUp = 0;
  cashSwipe.moved = false;
  setCashDrag(0, 0);
  if (event.pointerId !== undefined && zone.setPointerCapture) zone.setPointerCapture(event.pointerId);
  event.preventDefault();
  return true;
}

function moveCashSwipe(event) {
  const eventId = event.pointerId ?? cashSwipe.pointerId;
  if (!cashSwipe.active || eventId !== cashSwipe.pointerId) return false;
  const dx = event.clientX - cashSwipe.startX;
  const dy = event.clientY - cashSwipe.startY;
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) cashSwipe.moved = true;
  cashSwipe.maxUp = Math.max(cashSwipe.maxUp, -dy);
  setCashDrag(dx, dy);
  if (isCashSwipeValid()) {
    commitCashSwipe(event);
  }
  event.preventDefault();
  return true;
}

function isCashSwipeValid() {
  return cashSwipe.startLow && cashSwipe.moved && cashSwipe.maxUp > 86 && cashSwipe.dy < -74 && Math.abs(cashSwipe.dx) < 130;
}

function commitCashSwipe(event) {
  if (cashSwipe.committed) return;
  const now = performance.now();
  if (now - cashSwipe.lastCommitAt < 260) return;
  cashSwipe.lastCommitAt = now;
  const zone = el.screen.querySelector("[data-cash-swipe]");
  cashSwipe.committed = true;
  cashSwipe.active = false;
  if (zone) {
    zone.classList.remove("dragging", "snapback");
    zone.classList.add("counted");
    if (event?.pointerId !== undefined && zone.releasePointerCapture) {
      try {
        zone.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may already be released.
      }
    }
  }
  countBill({ render: false });
  if (navigator.vibrate) navigator.vibrate(8);
  window.setTimeout(render, 230);
  if (event) event.preventDefault();
}

function endCashSwipe(event) {
  const eventId = event.pointerId ?? cashSwipe.pointerId;
  if (!cashSwipe.active || eventId !== cashSwipe.pointerId) return false;
  const zone = el.screen.querySelector("[data-cash-swipe]");
  cashSwipe.active = false;
  if (event.pointerId !== undefined && zone?.releasePointerCapture) {
    try {
      zone.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released.
    }
  }
  if (isCashSwipeValid()) {
    commitCashSwipe(event);
  } else {
    zone?.classList.remove("dragging");
    zone?.classList.add("snapback");
    resetCashSwipe(140);
  }
  event.preventDefault();
  return true;
}

function cancelCashSwipe(event) {
  const eventId = event.pointerId ?? cashSwipe.pointerId;
  if (!cashSwipe.active || eventId !== cashSwipe.pointerId) return false;
  const zone = el.screen.querySelector("[data-cash-swipe]");
  cashSwipe.active = false;
  zone?.classList.remove("dragging");
  zone?.classList.add("snapback");
  resetCashSwipe(140);
  return true;
}

function downloadApp(id) {
  if (state.installed.includes(id)) return;
  state.installed.push(id);
  state.installedAt[id] = Date.now();
  state.stats.downloads += 1;
  addNotice(`${apps[id].name}下载完成`);
  advanceTutorial("download", id);
  render();
}

function buyNumber() {
  if (state.phoneNumber) return;
  if (state.cashBalance < FIRST_NUMBER_TOP_UP) {
    addNotice(`点钞余额不足，首次办卡需要自动首充 ${money(FIRST_NUMBER_TOP_UP)}。`);
    render();
    return;
  }
  state.cashBalance -= FIRST_NUMBER_TOP_UP;
  state.phoneNumber = randomPhoneNumber();
  state.carrierBalance += FIRST_NUMBER_TOP_UP;
  state.phonePlan = { ...structuredClone(defaultState.phonePlan), status: "已办号，未办套餐" };
  state.messages.unshift({ id: makeId(), from: "营业厅", to: "我", text: `你的手机号 ${state.phoneNumber} 已开通，并从点钞 App 自动扣 ${money(FIRST_NUMBER_TOP_UP)} 充入话费。现在必须办理套餐，否则手机还是砖头。`, time: nowTime() });
  advanceGameDay("办理电话卡");
  advanceTutorial("buyNumber");
  triggerMoneyFeedback({
    title: "手机号自动首充",
    amount: FIRST_NUMBER_TOP_UP,
    channel: "点钞余额",
    detail: `手机号 ${state.phoneNumber} 开通`,
    balance: `点钞余额 ${money(state.cashBalance)}，话费余额 ${money(state.carrierBalance)}`,
    source: "营业厅",
  });
  render();
}

function recharge() {
  if (!state.phoneNumber) {
    addNotice("充值失败：请先办理手机号。");
    render();
    return;
  }
  const payment = payFromCard(50, "话费充值", "营业厅", "银行卡充值话费");
  if (!payment) {
    render();
    return;
  }
  payment.meta = makePaymentMeta("carrier", { name: "话费充值", price: 50, desc: "银行卡充值话费", status: "话费已到账", tag: "话费" }, payment);
  state.carrierBalance += 50;
  addServiceRecord("carrier", { name: "话费充值", price: 50, desc: "银行卡充值话费", status: "话费已到账", tag: "话费" }, payment);
  addNotice("银行卡充值话费 ¥50");
  scheduleMoneyAftercare("营业厅", "充值到账复核", `话费充值 ${money(50)} 已完成，系统建议你继续花在套餐、电话和短信上。`, { category: "carrier" });
  render();
}

function buyPlan(planId = "basic") {
  if (!state.phoneNumber) {
    addNotice("办理套餐失败：请先办理手机号。");
    render();
    return;
  }
  const plan = carrierPlans[planId] || carrierPlans.basic;
  if (state.phonePlan?.active && state.phonePlan.id === plan.id) {
    addNotice(`${plan.name} 本月已经生效。`);
    render();
    return;
  }
  if (state.carrierBalance < plan.price) {
    addNotice(`套餐办理失败：话费不足，还差 ${money(plan.price - state.carrierBalance)}。先用银行卡充话费。`);
    render();
    return;
  }
  state.carrierBalance -= plan.price;
  state.phonePlan = {
    id: plan.id,
    name: plan.name,
    monthlyFee: plan.price,
    active: true,
    status: "本月已生效",
    startedAt: gameDateText(),
    paidMonthKey: monthKey(),
    expiredMonthKey: "",
  };
  state.stats.communicationFees += plan.price;
  addServiceRecord(
    "carrier",
    { name: plan.name, price: plan.price, desc: plan.desc, status: "套餐本月已生效", tag: "套餐" },
    { amount: plan.price, card: { name: "话费余额", number: "carrier" }, meta: makePaymentMeta("carrier", { name: plan.name, price: plan.price, desc: plan.desc, status: "套餐本月已生效", tag: "套餐" }, { amount: plan.price }) },
  );
  state.messages.unshift({ id: makeId(), from: "营业厅", to: "我", text: `${plan.name} 已生效。本月其他软件可以使用；下个月请手动续费。`, time: nowTime() });
  state.messages = state.messages.slice(0, 80);
  advanceGameDay("办理手机套餐");
  advanceTutorial("buyPlan", plan.id);
  triggerMoneyFeedback({
    title: plan.name,
    amount: plan.price,
    channel: "话费余额",
    detail: "手机套餐本月生效",
    balance: `话费余额 ${money(state.carrierBalance)}`,
    source: "营业厅",
  });
  scheduleMoneyAftercare("营业厅", "套餐权益提醒", `${plan.name} 已入网。下个月不手动续费，手机会再次变成精装修砖头。`, { category: "carrier" });
  render();
}

function newCard() {
  if (!hasActivePlan()) {
    addNotice(blockReasonForApp("bank"));
    render();
    return;
  }
  const card = {
    id: makeId(),
    name: `储蓄卡 ${state.cards.length + 1}`,
    number: randomCardNumber(),
    balance: 0,
    openedAt: nowTime(),
  };
  state.cards.unshift(card);
  if (!state.defaultCardId) state.defaultCardId = card.id;
  state.stats.cardsOpened += 1;
  state.messages.unshift({ id: makeId(), from: "XX银行", to: "我", text: `银行卡 ${formatCard(card.number)} 已开通。请复制卡号，转账别输错。`, time: nowTime() });
  addNotice("银行卡已办理");
  advanceGameDay("办理银行卡");
  advanceTutorial("newCard");
  render();
}

function copyCard(number) {
  state.clipboard = number;
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(number).catch(() => {});
  addNotice(`已复制卡号 ${formatCard(number)}`);
  advanceTutorial("copyCard");
  render();
}

function updateBankDraft() {
  const cardInput = el.screen.querySelector("[data-card-number]");
  const amountInput = el.screen.querySelector("[data-transfer-amount]");
  if (cardInput) state.transferDraft.cardNumber = cardInput.value;
  if (amountInput) state.transferDraft.amount = Math.max(1, Math.floor(Number(amountInput.value) || 0));
}

function transferToCard() {
  if (!hasActivePlan()) {
    addNotice(blockReasonForApp("bank"));
    render();
    return;
  }
  updateBankDraft();
  const amount = state.transferDraft.amount;
  if (state.cashBalance < amount) {
    addNotice("转账失败：点钞余额不足。");
    render();
    return;
  }

  state.cashBalance -= amount;
  const card = cardByNumber(state.transferDraft.cardNumber);
  if (!card) {
    state.stats.lostTransfers += 1;
    triggerMoneyFeedback({
      title: "输错卡号转账",
      amount,
      channel: "虚空账户",
      detail: "钱已经离开点钞 App，收款卡不存在",
      balance: `点钞余额 ${money(state.cashBalance)}`,
      source: "虚空银行",
      tone: "danger",
    });
    advanceGameDay("输错卡号转账");
    scheduleMoneyAftercare("虚空银行", "转账无法追回", `${money(amount)} 已进入虚空账户，客服表示看不见就是处理完了。`, { category: "bank" });
    render();
    return;
  }

  card.balance += amount;
  if (!state.defaultCardId) state.defaultCardId = card.id;
  state.stats.bankTransfers += 1;
  recordTransaction({
    direction: "in",
    title: "点钞转入银行卡",
    category: "银行",
    amount,
    cardName: card.name,
    cardNumber: card.number,
    detail: "从点钞 App 转入",
  });
  addNotice(`${money(amount)} 已转入 ${card.name}`);
  advanceGameDay("点钞转入银行卡");
  scheduleMoneyAftercare("XX银行", "入账回执", `${money(amount)} 已进入 ${card.name}，现在它终于能在手机世界里被花掉了。`, { category: "bank" });
  advanceTutorial("transferToCard");
  render();
}

function updatePersonTransferDraft() {
  const contactInput = el.screen.querySelector("[data-person-contact]");
  const amountInput = el.screen.querySelector("[data-person-amount]");
  const noteInput = el.screen.querySelector("[data-person-note]");
  if (contactInput) state.personTransferDraft.contactId = contactInput.value;
  if (amountInput) state.personTransferDraft.amount = Math.max(1, Math.floor(Number(amountInput.value) || 0));
  if (noteInput) state.personTransferDraft.note = noteInput.value.trim().slice(0, 40);
}

function transferToPerson(contactId, amount, note = "") {
  if (!hasActivePlan()) {
    addNotice(blockReasonForApp("wallet"));
    render();
    return;
  }
  const contact = contacts.find((item) => item.id === contactId) || contacts[0];
  const cleanAmount = Math.max(1, Math.floor(Number(amount) || 0));
  const payment = payFromCard(cleanAmount, `转账给${contact.name}`, "转账", note || contact.note);
  if (!payment) {
    render();
    return;
  }
  state.stats.personTransfers += 1;
  state.stats.personTransferAmount += cleanAmount;
  state.messages.unshift({
    id: makeId(),
    from: "钱包",
    to: "我",
    text: `你已向 ${contact.name}（${contact.phone}）转账 ${money(cleanAmount)}。${note ? `备注：${note}` : ""}`,
    time: nowTime(),
  });
  state.messages = state.messages.slice(0, 80);
  addServiceRecord(
    "wallet",
    {
      name: `转账给${contact.name}`,
      desc: note || contact.note,
      status: "转账已到账",
      tag: "转账",
    },
    {
      ...payment,
      meta: {
        orderNo: newOrderNumber("wallet"),
        merchant: contact.name,
        channel: "钱包转账",
        serviceFee: 0,
        invoice: "个人转账无发票",
        fulfillment: `${contact.phone} · ${note || contact.note}`,
        protection: "实时到账，不可撤回。",
      },
    },
  );
  scheduleMoneyAftercare(contact.name, "到账确认", `${contact.name} 已收到 ${money(cleanAmount)}。对方沉默，但系统说钱确实没了。`, { category: "wallet" });
  state.personTransferDraft = { ...state.personTransferDraft, contactId: contact.id, amount: cleanAmount, note };
  render();
}

function recordRedPacket(item, payment, category) {
  state.stats.redPackets += 1;
  state.messages.unshift({
    id: makeId(),
    from: apps[category]?.name || "钱包",
    to: "我",
    text: `${item.name} ${money(payment.amount)} 已发送，对方领取后不可撤回。`,
    time: nowTime(),
  });
  state.messages = state.messages.slice(0, 80);
}

function openCheckout(category, itemId) {
  if (category === "shop" && itemId === SHOP_CART_ID) {
    if (!shopCartLineItems().length) {
      addNotice("购物车还是空的，先加点想买的东西。");
      render();
      return;
    }
    state.checkoutDraft = { category, itemId, openedAt: Date.now() };
    render();
    return;
  }
  const item = (spendCatalogs[category] || []).find((entry) => entry.id === itemId);
  if (!item) return;
  state.checkoutDraft = { category, itemId, openedAt: Date.now() };
  render();
}

function closeCheckout() {
  state.checkoutDraft = null;
  render();
}

function confirmCheckout() {
  const draft = checkoutItemFromDraft();
  if (!draft) {
    closeCheckout();
    return;
  }
  state.checkoutDraft = null;
  buyCatalogItem(draft.category, draft.item.id);
}

function buyCatalogItem(category, itemId) {
  if (category === "credit") return buyCreditItem(itemId);
  const checkoutWasCart = category === "shop" && itemId === SHOP_CART_ID;
  const baseItem = checkoutWasCart ? shopCartBaseItem() : (spendCatalogs[category] || []).find((entry) => entry.id === itemId);
  if (!baseItem) return;
  const item = catalogItemForCheckout(category, baseItem);
  if (categoryRequiresNetwork(category) && !hasActivePlan()) {
    addNotice(blockReasonForApp(category));
    render();
    return;
  }
  if (category === "carrier" && !state.phoneNumber) {
    addNotice("办理失败：请先购买手机号。");
    render();
    return;
  }
  if (category === "carrier" && item.id === "premium-plan") return buyPlan("premium");
  if (category === "bank" && !state.cards.length) {
    addNotice("办理失败：请先开通至少一张银行卡。");
    render();
    return;
  }
  const categoryName = apps[category]?.name || item.tag || "消费";
  const payment = payCatalogItem(category, item, categoryName);
  if (!payment) {
    render();
    return;
  }
  payment.meta = makePaymentMeta(category, item, payment);
  if (item.hold) addHold(category, item, payment);
  if (item.loan) addLoanContract(category, item, payment);
  if (item.redPacket) recordRedPacket(item, payment, category);
  let postRecord = null;

  if (category === "store") {
    if (item.asset === "subscription") addSubscription(item, payment, category);
    postRecord = addServiceRecord(category, item, payment);
    state.stats.appStorePurchases += 1;
  } else if (category === "carrier") {
    if (item.id === "phone-bill") state.carrierBalance += payment.amount;
    if (item.asset === "subscription") addSubscription(item, payment, category);
    postRecord = addServiceRecord(category, item, payment);
    state.stats.billsPaid += 1;
  } else if (category === "bank") {
    if (item.asset === "subscription") addSubscription(item, payment, category);
    if (item.asset === "holding") addHolding(category, item, payment);
    postRecord = addServiceRecord(category, item, payment);
    state.stats.bankFees += payment.amount;
  } else if (category === "wallet") {
    if (item.asset === "subscription") addSubscription(item, payment, category);
    postRecord = addServiceRecord(category, item, payment);
    state.stats.walletPayments += payment.amount;
  } else if (category === "food") {
    if (item.asset === "subscription") addSubscription(item, payment, category);
    const food = item.foodBreakdown;
    postRecord = addOrder(category, item, payment, {
      status: `${item.status || "订单已提交"} · ${food?.deliveryLabel || "商家履约中"} · ${food?.eta || "永远还差 3 分钟"}`,
      detail: food
        ? `${baseItem.desc} ${food.address.label}：${food.address.address}；${food.tableware === "none" ? "无需餐具" : "需要餐具"}；${food.privacyNumber ? "隐私号保护" : "真实手机号联系"}；${food.invoice ? "已申请发票" : "未申请发票"}。${food.note ? `备注：${food.note}` : ""}`
        : `${item.desc} 骑手一直在路上，但不会真的到你手里。`,
      tracking: food ? `${food.deliveryLabel} · ${food.eta} · ${food.couponLabel}` : "预计 3 分钟后送达",
    });
  } else if (category === "shop") {
    if (item.asset === "subscription") addSubscription(item, payment, category);
    if (item.asset === "policy") addPolicy(item, payment);
    const shop = item.shopBreakdown;
    postRecord = addOrder(category, item, payment, {
      status: `${item.status || "订单已提交"} · ${shop?.shippingLabel || "平台履约"} · ${shop?.eta || "持续更新"}`,
      detail: shop
        ? `${baseItem.desc} ${shop.address.label}：${shop.address.address}；${shop.invoice ? "已申请发票" : "未申请发票"}；${shop.freightInsurance ? "含运费险" : "未买运费险"}；${shop.giftWrap ? "礼品包装" : "普通包装"}。${shop.remark ? `备注：${shop.remark}` : ""}`
        : `${item.desc} 真东西永远不会送到你手里。`,
      tracking: shop ? `${shop.shippingLabel} · ${shop.promise} · ${shop.returnRule}` : "包裹已离你很近，明天仍然很近",
      shopBreakdown: shop,
    });
    if (checkoutWasCart) state.shopCart = [];
  } else if (category === "travel") {
    const travel = item.travelBreakdown;
    postRecord = {
      id: makeId(),
      category,
      title: item.name,
      amount: payment.amount,
      status: `${item.status || "行程已确认"} · ${travel?.fulfillmentLabel || "等待履约"} · ${travel?.dateSlot?.label || "默认日期"}`,
      detail: travel
        ? `${baseItem.desc} ${travel.passenger.name}：${travel.passenger.cert}；${travel.route}；${travel.serviceLabel}；${travel.baggageFee ? `${travel.baggage.label} ${money(travel.baggageFee)}` : "未加购行李"}；${travel.insurance ? "含出行保障" : "未购保障"}；${travel.invoice ? "已申请发票" : "未申请发票"}。${travel.remark ? `备注：${travel.remark}` : ""}`
        : item.desc,
      meta: payment.meta,
      tracking: travel ? `${travel.route} · ${travel.fulfillmentLabel} · ${travel.returnRule}` : "行程已生成",
      travelBreakdown: travel,
      refundRate: travel?.refundRate,
      time: nowTime(),
      createdAt: Date.now(),
      cardName: payment.card?.name || (payment.credit ? "信用账户" : ""),
      cardNumber: payment.card?.number || (payment.credit ? "credit" : ""),
    };
    state.bookings.unshift(postRecord);
    state.bookings = state.bookings.slice(0, 60);
    state.stats.travelBookings += 1;
    if (travel) {
      addPhoneMessage("MoneyOS旅行", `${item.name} 已确认，${travel.passenger.name}，${travel.route}。${travel.fulfillmentLabel}，${travel.returnRule}。`);
    }
  } else if (category === "cars") {
    if (item.asset === "subscription") addSubscription(item, payment, category);
    if (item.asset === "policy") addPolicy(item, payment);
    if (item.asset === "vehicle") {
      state.assets.vehicles.unshift({
        id: makeId(),
        kind: item.tag,
        name: item.name,
        amount: payment.amount,
        detail: item.status,
        status: item.status,
        meta: payment.meta,
        time: nowTime(),
        createdAt: Date.now(),
      });
      state.assets.vehicles = state.assets.vehicles.slice(0, 40);
      state.stats.vehiclesBought += 1;
    } else {
      postRecord = addServiceRecord(category, item, payment);
    }
  } else if (category === "property") {
    if (item.asset === "property") {
      state.assets.properties.unshift({
        id: makeId(),
        kind: item.tag,
        name: item.name,
        amount: payment.amount,
        detail: item.status,
        status: item.status,
        meta: payment.meta,
        time: nowTime(),
        createdAt: Date.now(),
      });
      state.assets.properties = state.assets.properties.slice(0, 40);
      state.stats.propertiesPaid += 1;
    } else {
      postRecord = addServiceRecord(category, item, payment);
    }
  } else if (category === "services") {
    postRecord = addServiceRecord(category, item, payment);
    state.stats.billsPaid += 1;
  } else if (category === "insurance") {
    if (item.asset === "policy") addPolicy(item, payment);
    postRecord = addServiceRecord(category, item, payment);
    state.stats.insurancePolicies += 1;
  } else if (category === "subscriptions") {
    addSubscription(item, payment, category);
    postRecord = addServiceRecord(category, item, payment);
    state.stats.subscriptionPayments += 1;
  } else if (
    [
      "ride",
      "local",
      "health",
      "logistics",
      "gov",
      "education",
      "beauty",
      "pets",
      "recharge",
      "social",
      "rental",
      "office",
      "renovation",
      "parenting",
      "tickets",
      "overseas",
      "legal",
      "jobs",
      "events",
      "security",
    ].includes(category)
  ) {
    if (item.asset === "subscription") addSubscription(item, payment, category);
    if (item.asset === "policy") addPolicy(item, payment);
    postRecord = addServiceRecord(category, item, payment);
    if (category === "ride") state.stats.ridesTaken += 1;
    if (category === "local") state.stats.localServices += 1;
    if (category === "health") state.stats.healthPayments += 1;
    if (category === "logistics") state.stats.logisticsOrders += 1;
    if (category === "gov") state.stats.govPayments += 1;
    if (category === "education") state.stats.educationPayments += 1;
    if (category === "beauty") state.stats.beautyOrders += 1;
    if (category === "pets") state.stats.petPayments += 1;
    if (category === "recharge") state.stats.rechargePayments += 1;
    if (category === "social") state.stats.socialPayments += 1;
    if (category === "rental") state.stats.rentalOrders += 1;
    if (category === "office") state.stats.officePayments += 1;
    if (category === "renovation") state.stats.renovationPayments += 1;
    if (category === "parenting") state.stats.parentingPayments += 1;
    if (category === "tickets") state.stats.ticketOrders += 1;
    if (category === "overseas") state.stats.overseasPayments += 1;
    if (category === "legal") state.stats.legalPayments += 1;
    if (category === "jobs") state.stats.jobPayments += 1;
    if (category === "events") state.stats.eventPayments += 1;
    if (category === "security") state.stats.securityPayments += 1;
  } else if (category === "secondhand") {
    postRecord = addOrder(category, item, payment);
    state.stats.secondhandOrders += 1;
  } else if (category === "stocks") {
    addHolding(category, item, payment);
  } else {
    postRecord = addOrder(category, item, payment);
  }

  if (postRecord) createShipmentForRecord(postRecord, category, item, payment);
  scheduleSpendingAftercare(category, item);
  render();
}

function activateCredit() {
  if (state.credit.enabled) return;
  if (!hasActivePlan()) {
    addNotice(blockReasonForApp("credit"));
    render();
    return;
  }
  if (!state.phoneNumber || !state.cards.length) {
    addNotice("信用账户开通失败：需要手机号和银行卡。");
    render();
    return;
  }
  state.credit.enabled = true;
  state.credit.limit = Math.max(state.credit.limit, 30000 + state.cards.length * 5000);
  advanceGameDay("开通信用账户");
  state.messages.unshift({
    id: makeId(),
    from: "信用",
    to: "我",
    text: `信用账户已开通，总额度 ${money(state.credit.limit)}。先用后付不等于不用还。`,
    time: nowTime(),
  });
  addNotice("信用账户已开通");
  render();
}

function borrowCredit(amount) {
  const principal = Math.max(100, Math.floor(Number(amount) || 0));
  if (!hasActivePlan()) {
    addNotice(blockReasonForApp("credit"));
    render();
    return;
  }
  const card = state.cards[0];
  if (!state.credit.enabled || !card) {
    addNotice("借款失败：请先开通信用账户并办理银行卡。");
    render();
    return;
  }
  const fee = Math.max(20, Math.ceil(principal * 0.012));
  const totalDebt = principal + fee;
  if (creditAvailable() < totalDebt) {
    addNotice(`借款失败：可用额度不足，还差 ${money(totalDebt - creditAvailable())}。`);
    render();
    return;
  }

  state.credit.used += totalDebt;
  card.balance += principal;
  state.stats.creditLoans += principal;
  recordTransaction({
    direction: "in",
    title: "信用借款到账",
    category: "信用",
    amount: principal,
    cardName: card.name,
    cardNumber: card.number,
    detail: `服务费 ${money(fee)} 已入信用账单`,
  });
  recordCreditBill({
    type: "loan",
    title: "现金借款",
    category: "信用",
    amount: totalDebt,
    status: "下期应还",
    detail: `到账 ${money(principal)}，服务费 ${money(fee)}`,
  });
  addNotice(`借款 ${money(principal)} 已到账，账单 ${money(totalDebt)}`);
  advanceGameDay("信用借款");
  render();
}

function buyCreditItem(itemId) {
  if (!hasActivePlan()) {
    addNotice(blockReasonForApp("credit"));
    render();
    return;
  }
  const item = (spendCatalogs.credit || []).find((entry) => entry.id === itemId);
  if (!item) return;
  const installmentFee = item.months ? Math.ceil(item.price * 0.036) : 0;
  if (item.months && state.credit.enabled && creditAvailable() < item.price + installmentFee) {
    addNotice(`分期失败：本金和手续费共需 ${money(item.price + installmentFee)} 额度。`);
    render();
    return;
  }
  const payment = chargeCredit(item.price, item.name, "信用", item.desc, { status: item.status });
  if (!payment) {
    render();
    return;
  }
  payment.meta = makePaymentMeta("credit", item, payment);

  if (item.months) {
    const fee = installmentFee;
    const total = payment.amount + fee;
    state.credit.used += fee;
    state.credit.installments.unshift({
      id: makeId(),
      title: item.name,
      amount: total,
      monthly: Math.ceil(total / item.months),
      months: item.months,
      remainingMonths: item.months,
      paidAmount: 0,
      status: item.status,
      time: nowTime(),
    });
    state.credit.installments = state.credit.installments.slice(0, 60);
    recordCreditBill({
      type: "fee",
      title: `${item.name} 分期手续费`,
      category: "信用",
      amount: fee,
      status: "随分期偿还",
      detail: `${item.months} 期分期手续费`,
    });
  }

  const record = addServiceRecord("credit", item, payment);
  createShipmentForRecord(record, "credit", item, payment);
  scheduleSpendingAftercare("credit", item);
  render();
}

function chargeCreditRepayment(amount, title = "信用账单还款") {
  if (!state.credit.enabled || state.credit.used <= 0) {
    addNotice("当前没有需要还的信用账单。");
    return 0;
  }
  const cleanAmount = Math.min(Math.max(1, Math.floor(Number(amount) || 0)), Math.floor(state.credit.used));
  const payment = payFromCard(cleanAmount, title, "信用", "偿还信用额度", { countSpending: false });
  if (!payment) {
    return 0;
  }
  state.credit.used = Math.max(0, Math.floor(state.credit.used) - cleanAmount);
  state.stats.creditRepayments += cleanAmount;
  recordCreditBill({
    type: "repay",
    title,
    category: "信用",
    amount: cleanAmount,
    status: "额度已恢复",
    detail: payment.card.name,
  });
  addNotice(`信用已还款 ${money(cleanAmount)}`);
  scheduleMoneyAftercare("信用中心", "还款入账", `${title} ${money(cleanAmount)} 已入账，可用额度恢复了一点，心理负担也假装轻了一点。`, { category: "credit" });
  return cleanAmount;
}

function repayCredit(amount) {
  chargeCreditRepayment(amount);
  render();
}

function requestRefund(orderId) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) return;
  if (order.refundStatus) {
    addNotice("这笔订单已经申请过售后。");
    render();
    return;
  }
  const refundPlan = order.category === "shop" ? order.shopBreakdown : null;
  const refundRate = Math.max(0.1, Math.min(1, Number(refundPlan?.refundRate) || 0.92));
  const refundAmount = Math.max(1, Math.floor(order.amount * refundRate));
  const refundDeduction = Math.max(0, order.amount - refundAmount);
  const creditRefund = order.cardNumber === "credit";
  const card = creditRefund ? null : cardByNumber(order.cardNumber) || state.cards[0];
  if (!creditRefund && !card) {
    addNotice("退款失败：没有可退回的银行卡。");
    render();
    return;
  }

  if (creditRefund) {
    state.credit.used = Math.max(0, Math.floor(Number(state.credit.used) || 0) - refundAmount);
  } else {
    card.balance += refundAmount;
  }
  order.refundStatus = refundPlan ? "售后退款已退回" : "退款已退回";
  order.status = refundPlan ? `售后已完成 · 扣费 ${money(refundDeduction)}` : "售后已完成";
  state.refunds.unshift({
    id: makeId(),
    orderId: order.id,
    title: `退款：${order.title}`,
    amount: refundAmount,
    status: refundPlan
      ? `${creditRefund ? "已恢复信用额度" : "已退回原银行卡"}，${refundPlan.returnRule}，扣除 ${money(refundDeduction)}`
      : creditRefund
        ? "已恢复信用额度，平台扣除服务费"
        : "已退回原银行卡，平台扣除服务费",
    meta: order.meta,
    time: nowTime(),
    createdAt: Date.now(),
  });
  state.refunds = state.refunds.slice(0, 60);
  state.stats.refunds += 1;
  state.stats.refundAmount += refundAmount;
  recordTransaction({
    direction: "in",
    title: `退款：${order.title}`,
    category: "售后",
    amount: refundAmount,
    cardName: card?.name || "信用账户",
    cardNumber: card?.number || "credit",
    detail: creditRefund ? "恢复信用额度" : "原路退回",
  });
  addNotice(`${order.title} 已退款 ${money(refundAmount)}，扣费 ${money(refundDeduction)}`);
  advanceGameDay("售后退款");
  scheduleMoneyAftercare("售后客服", "退款回访", `${order.title} 的退款已处理，扣除 ${money(refundDeduction)}。钱回来了一部分，消费痕迹还留在手机里。`, { category: "refund", call: true });
  render();
}

function requestBookingRefund(bookingId) {
  const booking = state.bookings.find((item) => item.id === bookingId && item.category === "travel");
  if (!booking) return;
  if (booking.refundStatus) {
    addNotice("这笔行程已经退订过。");
    render();
    return;
  }
  const travel = booking.travelBreakdown || {};
  const refundRate = Math.max(0.1, Math.min(1, Number(travel.refundRate) || Number(booking.refundRate) || 0.82));
  const refundAmount = Math.max(1, Math.floor(booking.amount * refundRate));
  const refundDeduction = Math.max(0, booking.amount - refundAmount);
  const creditRefund = booking.cardNumber === "credit";
  const card = creditRefund ? null : cardByNumber(booking.cardNumber) || state.cards[0];
  if (!creditRefund && !card) {
    addNotice("退订失败：没有可退回的银行卡。");
    render();
    return;
  }

  if (creditRefund) {
    state.credit.used = Math.max(0, Math.floor(Number(state.credit.used) || 0) - refundAmount);
  } else {
    card.balance += refundAmount;
  }
  booking.refundStatus = "退订退款已退回";
  booking.status = `行程已退订 · 扣费 ${money(refundDeduction)}`;
  state.refunds.unshift({
    id: makeId(),
    orderId: booking.id,
    title: `退订：${booking.title}`,
    amount: refundAmount,
    status: `${creditRefund ? "已恢复信用额度" : "已退回原银行卡"}，${travel.returnRule || "按供应商退改规则扣费"}，扣除 ${money(refundDeduction)}`,
    meta: booking.meta,
    time: nowTime(),
    createdAt: Date.now(),
  });
  state.refunds = state.refunds.slice(0, 60);
  state.stats.refunds += 1;
  state.stats.refundAmount += refundAmount;
  recordTransaction({
    direction: "in",
    title: `退订：${booking.title}`,
    category: "旅行售后",
    amount: refundAmount,
    cardName: card?.name || "信用账户",
    cardNumber: card?.number || "credit",
    detail: creditRefund ? "恢复信用额度" : "原路退回",
  });
  addNotice(`${booking.title} 已退订，退回 ${money(refundAmount)}，扣费 ${money(refundDeduction)}`);
  advanceGameDay("旅行退订");
  scheduleMoneyAftercare("MoneyOS旅行客服", "退订回访", `${booking.title} 已退订，扣除 ${money(refundDeduction)}。行程没了，账单痕迹还在。`, { category: "travel", call: true });
  render();
}

function confirmTravelCheckIn(bookingId) {
  const booking = state.bookings.find((item) => item.id === bookingId && item.category === "travel");
  if (!booking) return;
  if (booking.refundStatus) {
    addNotice("已退订的行程不能再值机或入住。");
    render();
    return;
  }
  if (booking.checkInStatus) {
    addNotice("这笔行程已经确认过。");
    render();
    return;
  }
  const travel = booking.travelBreakdown || {};
  const label = travel.fulfillmentLabel || "行程确认";
  booking.checkInStatus = `${label}已确认`;
  booking.status = `${booking.status || "行程已确认"} · ${booking.checkInStatus}`;
  addNotice(`${booking.title} ${booking.checkInStatus}`);
  addPhoneMessage("MoneyOS旅行", `${booking.title} 已完成${label}。${travel.route ? `行程：${travel.route}。` : ""}请继续为下一笔旅途消费做准备。`);
  advanceGameDay("旅行确认");
  render();
}

function releaseHold(holdId) {
  const hold = state.holds.find((item) => item.id === holdId);
  if (!hold) return;
  if (String(hold.status || "").includes("退还") || String(hold.status || "").includes("释放")) {
    addNotice("这笔押金已经退过。");
    render();
    return;
  }

  const refundAmount = Math.max(1, Math.floor(Number(hold.refundable || hold.amount) || 0));
  const card = hold.cardNumber === "credit" ? null : cardByNumber(hold.cardNumber) || state.cards[0];
  if (!card && hold.cardNumber !== "credit") {
    addNotice("退押金失败：没有可退回的银行卡。");
    render();
    return;
  }

  if (hold.cardNumber === "credit") {
    state.credit.used = Math.max(0, Math.floor(state.credit.used) - refundAmount);
  } else {
    card.balance += refundAmount;
  }
  hold.status = "押金已退还";
  hold.releasedAt = nowTime();
  state.stats.depositRefunds += refundAmount;
  recordTransaction({
    direction: "in",
    title: `退押金：${hold.title}`,
    category: "押金",
    amount: refundAmount,
    cardName: card?.name || "信用账户",
    cardNumber: card?.number || "credit",
    detail: hold.detail || "押金释放",
  });
  addNotice(`${hold.title} 已退回 ${money(refundAmount)}`);
  advanceGameDay("退还押金");
  scheduleMoneyAftercare("账单", "押金退回回执", `${hold.title} 已退回 ${money(refundAmount)}，系统仍保留你曾经交过押金的记忆。`, { category: "billhub" });
  render();
}

function chargeSubscriptionRenewal(subscription) {
  if (!subscription) return 0;
  if (String(subscription.status || "").includes("取消")) {
    addNotice("续费失败：这个订阅已经取消自动续费。");
    return 0;
  }

  const amount = Math.max(1, Math.floor(Number(subscription.amount) || 0));
  const title = `${subscription.name}续费`;
  const payment = payFromCard(amount, title, "订阅", `${apps[subscription.source]?.name || "订阅"}自动续费`);
  if (!payment) {
    return 0;
  }
  payment.meta = makePaymentMeta(subscription.source || "subscriptions", {
    name: title,
    price: amount,
    desc: `${subscription.name} 自动续费扣款`,
    status: "续费成功",
    tag: subscription.cycle || "自动续费",
    asset: "subscription",
  }, payment);

  subscription.status = "自动续费已扣款";
  subscription.nextCharge = "下月同日";
  subscription.time = nowTime();
  state.stats.subscriptionRenewals += 1;
  state.stats.subscriptionPayments += 1;
  addServiceRecord(
    subscription.source || "subscriptions",
    {
      name: title,
      desc: `${subscription.name} 自动续费扣款`,
      status: "续费成功",
      tag: subscription.cycle || "自动续费",
    },
    payment,
  );
  addNotice(`${subscription.name} 已续费 ${money(amount)}`);
  scheduleMoneyAftercare(apps[subscription.source]?.name || "订阅", "续费回执", `${subscription.name} 已续费成功。下月同日，它还会很准时地想你。`, { category: "subscriptions" });
  return amount;
}

function renewSubscription(subscriptionId) {
  const subscription = state.subscriptions.find((item) => item.id === subscriptionId);
  if (!subscription) return;
  chargeSubscriptionRenewal(subscription);
  render();
}

function cancelSubscription(subscriptionId) {
  const subscription = state.subscriptions.find((item) => item.id === subscriptionId);
  if (!subscription) return;
  if (String(subscription.status || "").includes("取消")) {
    addNotice("这个订阅已经取消。");
    render();
    return;
  }
  subscription.status = "已取消自动续费";
  subscription.nextCharge = "不再扣费";
  state.stats.subscriptionCancels += 1;
  addNotice(`${subscription.name} 已取消自动续费`);
  render();
}

function chargeCreditInstallment(installment) {
  if (!installment) return 0;
  const remainingMonths = Math.max(0, Math.floor(Number(installment.remainingMonths ?? installment.months) || 0));
  if (!remainingMonths) {
    addNotice("这笔分期已经结清。");
    return 0;
  }
  if (!state.credit.enabled || state.credit.used <= 0) {
    installment.remainingMonths = 0;
    installment.status = "分期已结清";
    addNotice("信用账单已无欠款，分期标记为结清。");
    return 0;
  }

  const dueAmount = Math.min(Math.max(1, Math.floor(Number(installment.monthly) || 0)), Math.floor(state.credit.used));
  const payment = payFromCard(dueAmount, `${installment.title} 分期还款`, "信用", `分期还款，原 ${installment.months} 期`, {
    countSpending: false,
  });
  if (!payment) {
    return 0;
  }
  payment.meta = makePaymentMeta("credit", {
    name: `${installment.title} 分期还款`,
    price: dueAmount,
    desc: `分期还款，原 ${installment.months} 期`,
    status: "分期还款成功",
    tag: "分期",
  }, payment);

  state.credit.used = Math.max(0, Math.floor(state.credit.used) - dueAmount);
  installment.paidAmount = Math.floor(Number(installment.paidAmount) || 0) + dueAmount;
  installment.remainingMonths = Math.max(0, remainingMonths - 1);
  installment.status = installment.remainingMonths ? `已还一期，剩余 ${installment.remainingMonths} 期` : "分期已结清";
  state.stats.creditRepayments += dueAmount;
  state.stats.installmentRepayments += 1;
  recordCreditBill({
    type: "repay",
    title: `${installment.title} 分期还款`,
    category: "信用",
    amount: dueAmount,
    status: installment.status,
    detail: payment.card.name,
  });
  addNotice(`${installment.title} 已还一期 ${money(dueAmount)}`);
  scheduleMoneyAftercare("信用中心", "分期还款回执", `${installment.title} 已还一期，剩余 ${installment.remainingMonths} 期。手机把这个数字保存得很牢。`, { category: "credit" });
  return dueAmount;
}

function payInstallment(installmentId) {
  const installment = state.credit.installments.find((item) => item.id === installmentId);
  if (!installment) return;
  chargeCreditInstallment(installment);
  render();
}

function chargeLoanInstallment(loan) {
  if (!loan) return 0;
  const remainingMonths = Math.max(0, Math.floor(Number(loan.remainingMonths ?? loan.months) || 0));
  if (!remainingMonths) {
    addNotice("这笔贷款已经结清。");
    return 0;
  }

  const dueAmount = Math.max(1, Math.floor(Number(loan.monthly) || 0));
  const payment = payFromCard(dueAmount, `${loan.title} 月供`, apps[loan.category]?.name || "贷款", `${loan.lender || "贷款机构"}按期扣款`, {
    countSpending: true,
  });
  if (!payment) {
    return 0;
  }
  payment.meta = makePaymentMeta(loan.category || "bank", {
    name: `${loan.title} 月供`,
    price: dueAmount,
    desc: `${loan.lender || "贷款机构"}扣款，本金 ${money(loan.principal)}`,
    status: "月供已扣",
    tag: "月供",
  }, payment);

  loan.paidAmount = Math.floor(Number(loan.paidAmount) || 0) + dueAmount;
  loan.remainingMonths = Math.max(0, remainingMonths - 1);
  loan.status = loan.remainingMonths ? `已还一期，剩余 ${loan.remainingMonths} 期` : "贷款已结清";
  state.stats.loanRepayments += dueAmount;
  addServiceRecord(
    loan.category || "bank",
    {
      name: `${loan.title} 月供`,
      desc: `${loan.lender || "贷款机构"}扣款，本金 ${money(loan.principal)}`,
      status: loan.status,
      tag: "月供",
    },
    payment,
  );
  addNotice(`${loan.title} 已还月供 ${money(dueAmount)}`);
  scheduleMoneyAftercare(loan.lender || apps[loan.category]?.name || "贷款机构", "月供扣款回执", `${loan.title} 本期月供已扣，剩余 ${loan.remainingMonths} 期。`, { category: loan.category || "bank" });
  return dueAmount;
}

function payLoanInstallment(loanId) {
  const loan = state.loans.find((item) => item.id === loanId);
  if (!loan) return;
  chargeLoanInstallment(loan);
  render();
}

function payMonthlyCommitments() {
  const dueBefore = monthlyCommitmentTotal();
  if (!dueBefore) {
    addNotice("本月没有需要批量扣款的固定支出。");
    render();
    return;
  }

  let paid = 0;
  let successCount = 0;
  let failedCount = 0;
  const creditMinimum = state.credit.enabled && state.credit.used > 0 ? Math.min(state.credit.used, Math.max(100, Math.ceil(state.credit.used * 0.1))) : 0;
  if (creditMinimum) {
    const paidAmount = chargeCreditRepayment(creditMinimum, "本月信用最低还款");
    if (paidAmount) {
      paid += paidAmount;
      successCount += 1;
    } else {
      failedCount += 1;
    }
  }

  activeSubscriptions().forEach((subscription) => {
    const paidAmount = chargeSubscriptionRenewal(subscription);
    if (paidAmount) {
      paid += paidAmount;
      successCount += 1;
    } else {
      failedCount += 1;
    }
  });

  activeLoans().forEach((loan) => {
    const paidAmount = chargeLoanInstallment(loan);
    if (paidAmount) {
      paid += paidAmount;
      successCount += 1;
    } else {
      failedCount += 1;
    }
  });

  activeInstallments().forEach((installment) => {
    const paidAmount = chargeCreditInstallment(installment);
    if (paidAmount) {
      paid += paidAmount;
      successCount += 1;
    } else {
      failedCount += 1;
    }
  });

  state.stats.recurringRuns += 1;
  state.stats.recurringPaid += paid;
  state.billRuns.unshift({
    id: makeId(),
    title: "本月固定支出批量扣款",
    amount: paid,
    status: `成功 ${successCount} 项${failedCount ? `，失败 ${failedCount} 项` : ""}`,
    time: nowTime(),
    createdAt: Date.now(),
  });
  state.billRuns = state.billRuns.slice(0, 30);
  addNotice(`本月固定支出已处理 ${successCount} 项，共 ${money(paid)}`);
  if (paid) scheduleMoneyAftercare("账单", "固定支出汇总", `本月固定支出批量扣款完成：成功 ${successCount} 项，共 ${money(paid)}${failedCount ? `，失败 ${failedCount} 项` : ""}。`, { category: "billhub" });
  render();
}

function makeCall() {
  if (!hasActivePlan() || !state.dialNumber) {
    addNotice(blockReasonForApp("phone"));
    render();
    return;
  }
  if (state.carrierBalance < CALL_FEE) {
    addNotice(`通话失败：话费不足，至少需要 ${money(CALL_FEE)}。`);
    render();
    return;
  }
  const dialedNumber = state.dialNumber;
  state.carrierBalance -= CALL_FEE;
  state.stats.communicationFees += CALL_FEE;
  const result = Math.random() > 0.45 ? "已接通" : "无人接听";
  state.calls.unshift({ id: makeId(), number: dialedNumber, type: "呼出", result, time: nowTime() });
  state.stats.callsMade += 1;
  addServiceRecord(
    "carrier",
    {
      name: "语音通话费",
      desc: `拨打 ${dialedNumber}`,
      status: `已扣话费 ${money(CALL_FEE)}`,
      tag: "通话",
    },
    { amount: CALL_FEE, card: { name: "话费余额", number: "carrier" } },
  );
  advanceGameDay("语音通话");
  triggerMoneyFeedback({
    title: "语音通话费",
    amount: CALL_FEE,
    channel: "话费余额",
    detail: `拨打 ${dialedNumber} · ${result}`,
    balance: `话费余额 ${money(state.carrierBalance)}`,
    source: "营业厅",
  });
  scheduleMoneyAftercare("营业厅", "通话详单", `拨打 ${dialedNumber} 的通话费 ${money(CALL_FEE)} 已计入详单，结果：${result}。`, { category: "carrier" });
  state.dialNumber = "";
  render();
}

function receiveCall() {
  if (tutorialActive()) return;
  if (!hasActivePlan()) return;
  const callers = ["10086", "95588", "快递员", "未知号码", "很像老板的人"];
  const number = callers[Math.floor(Math.random() * callers.length)];
  state.calls.unshift({ id: makeId(), number, type: "呼入", result: "响铃 3 秒", time: nowTime() });
  state.stats.callsReceived += 1;
  addNotice(`${number} 来电`);
  if (number === "10086") {
    state.messages.unshift({ id: makeId(), from: "10086", to: "我", text: "尊敬的用户，您的钱正在以套餐的形式变少。", time: nowTime() });
  }
  render();
}

function sendSms() {
  const toInput = el.screen.querySelector("[data-sms-to]");
  const textInput = el.screen.querySelector("[data-sms-text]");
  state.smsDraft.to = toInput ? toInput.value.trim() : "";
  state.smsDraft.text = textInput ? textInput.value.trim() : "";
  if (!hasActivePlan()) {
    addNotice(blockReasonForApp("sms"));
    render();
    return;
  }
  if (!state.smsDraft.to || !state.smsDraft.text) {
    addNotice("短信发送失败：缺号码或内容。");
    render();
    return;
  }
  if (state.carrierBalance < SMS_FEE) {
    addNotice(`短信发送失败：话费不足，至少需要 ${money(SMS_FEE)}。`);
    render();
    return;
  }
  state.carrierBalance -= SMS_FEE;
  state.stats.communicationFees += SMS_FEE;
  state.messages.unshift({ id: makeId(), from: "我", to: state.smsDraft.to, text: state.smsDraft.text, time: nowTime() });
  state.stats.smsSent += 1;
  addServiceRecord(
    "carrier",
    {
      name: "短信通信费",
      desc: `发送到 ${state.smsDraft.to}`,
      status: `已扣话费 ${money(SMS_FEE)}`,
      tag: "短信",
    },
    { amount: SMS_FEE, card: { name: "话费余额", number: "carrier" } },
  );
  state.smsDraft.text = "";
  advanceGameDay("发送短信");
  triggerMoneyFeedback({
    title: "短信通信费",
    amount: SMS_FEE,
    channel: "话费余额",
    detail: `发送到 ${state.smsDraft.to}`,
    balance: `话费余额 ${money(state.carrierBalance)}`,
    source: "营业厅",
  });
  scheduleMoneyAftercare("营业厅", "短信发送回执", `发送到 ${state.smsDraft.to} 的短信已扣 ${money(SMS_FEE)}，系统认为这是一笔很严肃的通信消费。`, { category: "carrier" });
  render();
}

el.screen.addEventListener("click", (event) => {
  const open = event.target.closest("[data-open]");
  if (open) {
    if (!guardTutorialAction("open", open.dataset.open, event)) return;
    return setApp(open.dataset.open);
  }

  if (event.target.closest("[data-home]")) {
    if (!guardTutorialAction("home", "", event)) return;
    return setApp("home");
  }

  const appButton = event.target.closest("[data-app]");
  if (appButton) {
    const action = appButton.dataset.app === "home" ? "home" : "open";
    if (!guardTutorialAction(action, appButton.dataset.app, event)) return;
    return setApp(appButton.dataset.app);
  }

  if (event.target.closest("[data-close-checkout]")) {
    if (!guardTutorialAction("checkout", "", event)) return;
    return closeCheckout();
  }

  if (event.target.closest("[data-confirm-checkout]")) {
    if (!guardTutorialAction("checkout", "", event)) return;
    return confirmCheckout();
  }

  const download = event.target.closest("[data-download]");
  if (download) {
    if (!guardTutorialAction("download", download.dataset.download, event)) return;
    return downloadApp(download.dataset.download);
  }

  if (event.target.closest("[data-buy-number]")) {
    if (!guardTutorialAction("buyNumber", "", event)) return;
    return buyNumber();
  }
  const planButton = event.target.closest("[data-buy-plan]");
  if (planButton) {
    if (!guardTutorialAction("buyPlan", planButton.dataset.buyPlan, event)) return;
    return buyPlan(planButton.dataset.buyPlan);
  }
  if (event.target.closest("[data-recharge]")) {
    if (!guardTutorialAction("recharge", "", event)) return;
    return recharge();
  }
  if (event.target.closest("[data-new-card]")) {
    if (!guardTutorialAction("newCard", "", event)) return;
    return newCard();
  }

  const copy = event.target.closest("[data-copy-card]");
  if (copy) {
    if (!guardTutorialAction("copyCard", "", event)) return;
    return copyCard(copy.dataset.copyCard);
  }

  const defaultCard = event.target.closest("[data-default-card]");
  if (defaultCard) {
    if (!guardTutorialAction("defaultCard", "", event)) return;
    state.defaultCardId = defaultCard.dataset.defaultCard;
    addNotice("已切换默认支付银行卡");
    return render();
  }

  if (event.target.closest("[data-paste-card]")) {
    if (!guardTutorialAction("pasteCard", "", event)) return;
    state.transferDraft.cardNumber = state.clipboard;
    advanceTutorial("pasteCard");
    return render();
  }

  if (event.target.closest("[data-transfer-to-card]")) {
    if (!guardTutorialAction("transferToCard", "", event)) return;
    return transferToCard();
  }

  if (event.target.closest("[data-credit-activate]")) {
    if (!guardTutorialAction("creditActivate", "", event)) return;
    return activateCredit();
  }

  const creditLoan = event.target.closest("[data-credit-loan]");
  if (creditLoan) {
    if (!guardTutorialAction("creditLoan", "", event)) return;
    return borrowCredit(creditLoan.dataset.creditLoan);
  }

  const creditRepay = event.target.closest("[data-credit-repay]");
  if (creditRepay) {
    if (!guardTutorialAction("creditRepay", "", event)) return;
    return repayCredit(creditRepay.dataset.creditRepay);
  }

  const refundOrder = event.target.closest("[data-refund-order]");
  if (refundOrder) {
    if (!guardTutorialAction("refund", "", event)) return;
    return requestRefund(refundOrder.dataset.refundOrder);
  }

  const refundBooking = event.target.closest("[data-refund-booking]");
  if (refundBooking) {
    if (!guardTutorialAction("refundBooking", "", event)) return;
    return requestBookingRefund(refundBooking.dataset.refundBooking);
  }

  const travelCheckIn = event.target.closest("[data-travel-checkin]");
  if (travelCheckIn) {
    if (!guardTutorialAction("travelCheckIn", "", event)) return;
    return confirmTravelCheckIn(travelCheckIn.dataset.travelCheckin);
  }

  const shipmentSign = event.target.closest("[data-sign-shipment]");
  if (shipmentSign) {
    if (!guardTutorialAction("signShipment", "", event)) return;
    return signShipment(shipmentSign.dataset.signShipment);
  }

  const release = event.target.closest("[data-release-hold]");
  if (release) {
    if (!guardTutorialAction("releaseHold", "", event)) return;
    return releaseHold(release.dataset.releaseHold);
  }

  const renew = event.target.closest("[data-renew-subscription]");
  if (renew) {
    if (!guardTutorialAction("renewSubscription", "", event)) return;
    return renewSubscription(renew.dataset.renewSubscription);
  }

  const cancelSubscriptionButton = event.target.closest("[data-cancel-subscription]");
  if (cancelSubscriptionButton) {
    if (!guardTutorialAction("cancelSubscription", "", event)) return;
    return cancelSubscription(cancelSubscriptionButton.dataset.cancelSubscription);
  }

  const installmentPayment = event.target.closest("[data-pay-installment]");
  if (installmentPayment) {
    if (!guardTutorialAction("payInstallment", "", event)) return;
    return payInstallment(installmentPayment.dataset.payInstallment);
  }

  const loanPayment = event.target.closest("[data-pay-loan]");
  if (loanPayment) {
    if (!guardTutorialAction("payLoan", "", event)) return;
    return payLoanInstallment(loanPayment.dataset.payLoan);
  }

  if (event.target.closest("[data-pay-monthly]")) {
    if (!guardTutorialAction("payMonthly", "", event)) return;
    return payMonthlyCommitments();
  }

  const shopCheckoutCart = event.target.closest("[data-shop-checkout-cart]");
  if (shopCheckoutCart) {
    if (!guardTutorialAction("shopCartCheckout", "", event)) return;
    return openCheckout("shop", SHOP_CART_ID);
  }

  const shopAddCart = event.target.closest("[data-shop-add-cart]");
  if (shopAddCart) {
    if (!guardTutorialAction("shopAddCart", "", event)) return;
    return addShopCartItem(shopAddCart.dataset.shopAddCart);
  }

  const shopCartQty = event.target.closest("[data-shop-cart-qty]");
  if (shopCartQty) {
    if (!guardTutorialAction("shopCartQty", "", event)) return;
    return updateShopCartQuantity(shopCartQty.dataset.shopCartQty, Math.floor(Number(shopCartQty.dataset.shopCartDelta) || 0));
  }

  const shopCartRemove = event.target.closest("[data-shop-cart-remove]");
  if (shopCartRemove) {
    if (!guardTutorialAction("shopCartRemove", "", event)) return;
    return removeShopCartItem(shopCartRemove.dataset.shopCartRemove);
  }

  const shopOption = event.target.closest("[data-shop-option]");
  if (shopOption) {
    if (!guardTutorialAction("shopOption", "", event)) return;
    updateShopDraft({ [shopOption.dataset.shopOption]: shopOption.dataset.shopValue || "" });
    return render();
  }

  const shopToggle = event.target.closest("[data-shop-toggle]");
  if (shopToggle) {
    if (!guardTutorialAction("shopToggle", "", event)) return;
    const key = shopToggle.dataset.shopToggle;
    updateShopDraft({ [key]: !currentShopDraft()[key] });
    return render();
  }

  const foodOption = event.target.closest("[data-food-option]");
  if (foodOption) {
    if (!guardTutorialAction("foodOption", "", event)) return;
    const key = foodOption.dataset.foodOption;
    const rawValue = foodOption.dataset.foodValue || "";
    const value = key === "riderTip" ? Math.max(0, Math.floor(Number(rawValue) || 0)) : rawValue;
    updateFoodDraft({ [key]: value });
    return render();
  }

  const foodToggle = event.target.closest("[data-food-toggle]");
  if (foodToggle) {
    if (!guardTutorialAction("foodToggle", "", event)) return;
    const key = foodToggle.dataset.foodToggle;
    updateFoodDraft({ [key]: !currentFoodDraft()[key] });
    return render();
  }

  const travelOption = event.target.closest("[data-travel-option]");
  if (travelOption) {
    if (!guardTutorialAction("travelOption", "", event)) return;
    updateTravelDraft({ [travelOption.dataset.travelOption]: travelOption.dataset.travelValue || "" });
    return render();
  }

  const travelToggle = event.target.closest("[data-travel-toggle]");
  if (travelToggle) {
    if (!guardTutorialAction("travelToggle", "", event)) return;
    const key = travelToggle.dataset.travelToggle;
    updateTravelDraft({ [key]: !currentTravelDraft()[key] });
    return render();
  }

  const paymentMethod = event.target.closest("[data-payment-method]");
  if (paymentMethod) {
    if (!guardTutorialAction("paymentMethod", paymentMethod.dataset.paymentMethod, event)) return;
    const method = paymentMethod.dataset.paymentMethod === "credit" ? "credit" : "card";
    if (method === "credit" && !state.credit.enabled) {
      addNotice("请先在信用 App 开通信用账户。");
      return render();
    }
    state.checkoutMethod = method;
    addNotice(`已切换为${checkoutMethodLabel()}支付`);
    return render();
  }

  const spendFilter = event.target.closest("[data-spend-filter-category]");
  if (spendFilter) {
    if (!guardTutorialAction("spendFilter", spendFilter.dataset.spendFilterCategory, event)) return;
    state.spendFilters[spendFilter.dataset.spendFilterCategory] = spendFilter.dataset.spendFilterTag || "全部";
    return render();
  }

  const spendButton = event.target.closest("[data-spend-category]");
  if (spendButton) {
    if (!guardTutorialAction("spend", spendButton.dataset.spendCategory, event)) return;
    return openCheckout(spendButton.dataset.spendCategory, spendButton.dataset.spendId);
  }

  const quickTransfer = event.target.closest("[data-quick-transfer]");
  if (quickTransfer) {
    if (!guardTutorialAction("transferPerson", "", event)) return;
    return transferToPerson(quickTransfer.dataset.quickTransfer, quickTransfer.dataset.quickAmount, "快捷转账");
  }

  if (event.target.closest("[data-transfer-person]")) {
    if (!guardTutorialAction("transferPerson", "", event)) return;
    updatePersonTransferDraft();
    return transferToPerson(state.personTransferDraft.contactId, state.personTransferDraft.amount, state.personTransferDraft.note);
  }

  const dial = event.target.closest("[data-dial]");
  if (dial) {
    if (!guardTutorialAction("dial", dial.dataset.dial, event)) return;
    state.dialNumber = `${state.dialNumber}${dial.dataset.dial}`.slice(0, 18);
    return render();
  }
  if (event.target.closest("[data-clear-dial]")) {
    if (!guardTutorialAction("clearDial", "", event)) return;
    state.dialNumber = "";
    return render();
  }
  if (event.target.closest("[data-call]")) {
    if (!guardTutorialAction("call", "", event)) return;
    return makeCall();
  }
  if (event.target.closest("[data-send-sms]")) {
    if (!guardTutorialAction("sendSms", "", event)) return;
    return sendSms();
  }
});

el.screen.addEventListener("pointerdown", beginCashSwipe);
el.screen.addEventListener("pointermove", moveCashSwipe);
el.screen.addEventListener("pointerup", endCashSwipe);
el.screen.addEventListener("pointercancel", cancelCashSwipe);
el.screen.addEventListener("lostpointercapture", cancelCashSwipe);
el.screen.addEventListener("mousedown", beginCashSwipe);
el.screen.addEventListener("mousemove", moveCashSwipe);
el.screen.addEventListener("mouseup", endCashSwipe);
el.screen.addEventListener("mouseleave", cancelCashSwipe);

el.screen.addEventListener("input", (event) => {
  if (!guardTutorialAction("input", "", event)) {
    render();
    return;
  }
  if (event.target.matches("[data-card-number], [data-transfer-amount]")) updateBankDraft();
  if (event.target.matches("[data-person-contact], [data-person-amount], [data-person-note]")) updatePersonTransferDraft();
  if (event.target.matches("[data-food-note]")) updateFoodDraft({ note: event.target.value });
  if (event.target.matches("[data-shop-remark]")) updateShopDraft({ remark: event.target.value });
  if (event.target.matches("[data-travel-remark]")) updateTravelDraft({ remark: event.target.value });
  if (event.target.matches("[data-sms-to]")) state.smsDraft.to = event.target.value;
  if (event.target.matches("[data-sms-text]")) state.smsDraft.text = event.target.value;
  saveState();
});

el.screen.addEventListener("change", (event) => {
  if (!guardTutorialAction("input", "", event)) {
    render();
    return;
  }
  if (event.target.matches("[data-person-contact], [data-person-amount], [data-person-note]")) updatePersonTransferDraft();
  saveState();
});

el.homeButton.addEventListener("click", (event) => {
  if (!guardTutorialAction("home", "", event)) return;
  setApp("home");
});
el.backButton.addEventListener("click", (event) => {
  if (!guardTutorialAction("home", "", event)) return;
  setApp("home");
});
el.taskButton.addEventListener("click", (event) => {
  if (!guardTutorialAction("open", "store", event)) return;
  setApp("store");
});

setInterval(() => {
  callTimer += 1;
  if (callTimer >= 18) {
    callTimer = 0;
    if (!tutorialActive() && state.activeApp !== "cash" && Math.random() > 0.45) receiveCall();
  } else {
    el.phoneClock.textContent = nowTime();
  }
}, 1000);

render();
