import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { formatMoney } from '@shared/money';

export type Lang = 'en' | 'zh';

export const LANG_STORAGE_KEY = 'billswipe.lang';

/**
 * Translation table.
 *
 * Keys are the English source strings (gettext-style msgids) so components stay
 * readable and a missing entry degrades to English instead of showing a key.
 * Placeholders use {name} syntax and are interpolated after lookup.
 */
const zh: Record<string, string> = {
  // ---------------------------------------------------------------- common
  'Loading…': '加载中…',
  Loading: '加载中',
  Close: '关闭',
  Cancel: '取消',
  Save: '保存',
  'Save changes': '保存修改',
  Retry: '重试',
  'Try again': '重试',
  Refresh: '刷新',
  Back: '返回',
  Continue: '继续',
  'Continue anyway': '仍然继续',
  'See all': '查看全部',
  Help: '帮助',
  Pass: '跳过',
  Undo: '撤销',
  'Super Help': '超级帮助',
  Open: '打开',
  'Open bill': '打开账单',
  Verified: '已核实',
  Demo: '演示',
  Sandbox: '沙箱',
  Anonymous: '匿名',
  Named: '署名',
  You: '你',
  'just now': '刚刚',
  '{n}m ago': '{n} 分钟前',
  '{n}h ago': '{n} 小时前',
  '{n}d ago': '{n} 天前',
  '{n}w ago': '{n} 周前',
  'Skip to content': '跳到主要内容',
  'Dismiss notification': '关闭通知',
  'Sign in': '登录',
  'Sign out': '退出登录',
  'Create account': '创建账户',
  'Or': '或',

  // ---------------------------------------------------------------- nav / shell
  Discover: '发现',
  'My Bills': '我的账单',
  'My bills': '我的账单',
  Activity: '动态',
  Profile: '个人中心',
  'Your profile': '你的个人中心',
  Community: '社区',
  Notifications: '通知',
  Admin: '管理后台',
  'Find a bill': '找账单',
  'Post a bill': '发布账单',
  Post: '发布',
  'Author on X': '作者的 X',
  'BILL SWIPE home': 'BILL SWIPE 首页',
  'Primary': '主导航',
  'Primary mobile': '底部导航',
  'Someone’s bill. Someone’s kindness.': '一张账单，一份善意。',
  "Someone's bill. Someone's kindness.": '一张账单，一份善意。',
  'Swipe to discover real stories, then choose to help — never automatically.': '滑动发现真实故事，帮助永远由你决定 —— 绝不自动扣款。',
  'Built by @0xkillcoin': '由 @0xkillcoin 构建',
  Product: '产品',
  Trust: '信任',
  More: '更多',
  'Trust & safety': '信任与安全',
  'Payment sandbox': '支付沙箱',
  FAQ: '常见问题',
  'How it works': '运作方式',
  'About the project': '关于项目',
  'Author on X ↗': '作者的 X ↗',
  '© {year} BILL SWIPE · Payment sandbox build. No real money is moved in this deployment.':
    '© {year} BILL SWIPE · 支付沙箱版本，本次部署不产生真实资金流动。',
  'Language': '语言',
  'Switch language': '切换语言',
  'Change language to Chinese': '切换为中文',
  'Change language to English': '切换为英文',

  // ---------------------------------------------------------------- landing
  'Swipe to discover · help only when you choose': '滑动发现 · 只在你想帮时才帮',
  'A little swipe.': '一次轻滑，',
  'A big difference.': '一点大的改变。',
  'Somewhere out there, someone needs a little help right now. Browse real bills, swipe past what you can’t take on, and step in where you can. You might be the person who makes their day.':
    '此刻某处，有人正需要一点帮助。浏览真实账单，划掉你无法承担的部分，在你力所能及处伸手。也许你就是那个让 TA 好起来的人。',
  'Start swiping': '开始滑动',
  'Post your bill': '发布我的账单',
  'Every bill human-reviewed': '每张账单人工审核',
  'Receipts stay private': '凭证仅审核可见',
  'Swiping never charges you': '滑动永不扣款',
  'Swipe right to help': '右滑表示愿意帮助',
  'Swipe left to pass. No charge, ever.': '左滑跳过，永不扣款。',
  'Bills helped': '被帮助的账单',
  'Given in help': '已帮助金额',
  'People supported': '受助人数',
  'Connections made': '建立的连接',
  'Includes clearly-labelled demo data seeded for this preview build — never presented as real platform performance.':
    '包含本预览版明确标注的演示数据 —— 从不冒充真实平台成绩。',
  'Three taps from scrolling to someone’s good day.': '三次点击，从刷手机到让某人好过一天。',
  'Swipe through bills': '滑过一张张账单',
  'Real people post the bill they cannot cover this week. Swipe left to pass, right when you want to help, up for Super Help.':
    '真实的人在这里贴出这周付不掉的账单。左滑跳过，右滑表示愿意帮助，上滑进入超级帮助。',
  'Choose your amount': '选择金额',
  'Nothing is charged by a swipe. Pick $5, $10, $25, or your own amount and see exactly what you pay — fee included — before confirming.':
    '滑动不会扣款。选择 5、10、25 美元或自定金额，并在确认前看清含手续费在内的确切总额。',
  'Watch it land': '看着它生效',
  'Your help updates the bill instantly, both sides get a notification, and the story shows up in the community feed.':
    '你的帮助会即时更新账单，双方都会收到通知，故事也会出现在社区动态里。',
  'Live now': '正在进行',
  'Bills waiting for a little kindness': '等待一点善意的账单',
  'Recent acts of kindness': '最近的善意',
  'Good things happen here, quietly.': '好事在这里安静地发生。',
  'Anonymous by default if you want. Every entry below is generated from an actual help record — no stock testimonials, no invented numbers.':
    '你可以默认匿名。以下每一条都来自真实的帮助记录 —— 没有影楼式证言，也没有编造的数字。',
  'Open the community': '进入社区',
  'Someone helped Maria R. with groceries': '有人帮 Maria R. 支付了食品杂货',
  'A $25 top-up arrived four hours after she posted.': '她发布四小时后，25 美元的帮助到账了。',
  'James K. reached 78% of his therapy bill': 'James K. 的康复治疗费已筹到 78%',
  'Eleven people chipped in this week.': '这周有十一个人一起凑了这笔钱。',
  'A family got their rent covered': '一个家庭的房租被补上了',
  'Diego S. is three days from his deadline.': 'Diego S. 距离截止日还有三天。',
  'Human review before anything goes live': '上架前一定有人工审核',
  'Every bill is checked by a moderator against its uploaded receipt before it appears in Discover.':
    '每张账单都要由审核员对照上传凭证核对后，才会出现在「发现」里。',
  'Receipts are private by default': '凭证默认私密',
  'Original documents live in private storage. The public page only ever shows a redacted preview.':
    '原件存放在私有存储中，公开页面最多只展示脱敏预览。',
  'Fees and totals shown before you pay': '付款前显示费用与总额',
  'The confirmation screen lists the amount, any platform fee, and the exact total. Swiping never charges you.':
    '确认页会列出帮助金额、平台手续费与确切总额。滑动永不扣款。',
  'No poverty leaderboards': '没有贫困排行榜',
  'We do not rank people by need or helpers by generosity. Achievements track presence, never spending.':
    '我们不按需求给受助者排名，也不按慷慨程度给帮助者排名。成就只记录参与，不衡量支出。',
  'Money between strangers needs guardrails, not vibes.': '陌生人之间的资金流动，需要护栏，而不是凭感觉。',
  'BILL SWIPE is designed so that no swipe, tap, or stray request can move money without an explicit, itemised confirmation.':
    'BILL SWIPE 的设计原则是：没有任何滑动、点击或误触，能在缺少明确、逐项确认的情况下动到一分钱。',
  'The questions people actually ask': '大家真正会问的问题',
  'Does swiping right send money?': '右滑就会付钱吗？',
  'No. A right swipe records that you are willing to help and opens the amount picker. Nothing is charged until you pick an amount, review the itemised total, and confirm on the payment screen.':
    '不会。右滑只是记录你愿意帮助，并打开金额选择。只有你选定金额、核对逐项总额，并在支付页确认后才会真的付款。',
  'Is this deployment handling real money?': '这个部署在处理真实资金吗？',
  'Not yet. This build runs a clearly-labelled Payment Sandbox. Every payment is marked as a sandbox transaction, the server settles it, and no card or bank is ever charged. Switching to a real provider is a configuration change, not a rewrite.':
    '还没有。本版本运行的是明确标注的「支付沙箱」：每笔支付都标记为沙箱交易，由服务端完成结算，不会触及任何银行卡。切换到真实渠道是配置层面的改动，不需要重写。',
  'Who can see my receipt?': '谁能看到我的凭证？',
  'Only you and the moderation team. Originals are stored privately; the public bill page shows a redacted preview at most. Please cover ID numbers, card numbers, full addresses and medical details before uploading.':
    '只有你和审核团队。原件私有存储，公开页面最多显示脱敏预览。上传前请遮挡证件号、银行卡号、完整住址与医疗隐私。',
  'What if a bill is fully funded?': '账单筹满会怎样？',
  'It flips to Fully Funded automatically, new payments are refused at the API level, and both the owner and everyone who helped get a notification.':
    '会自动标记为「已筹满」，接口层面拒绝新的支付，并且账单主人和所有帮助者都会收到通知。',
  'Can I stay anonymous?': '我可以匿名吗？',
  'Yes. Anonymous help hides your name from the bill owner and community feed, but our moderation team can still see the record if there is a dispute.':
    '可以。匿名帮助会对账单主人和社区隐藏你的名字；如有争议，仅审核团队可查看记录。',
  'Someone is one swipe away from a better day.': '有人离好过一天，只差一次滑动。',
  'Ready when you are, {name}.': '随时开始，{name}。',
  'Free to browse. Free to post. You only ever pay when you decide to help, and you always see the total first.':
    '浏览免费，发布免费。只有你决定帮助时才会付款，而且总能先看到总额。',

  // ---------------------------------------------------------------- discover
  'Fresh bills, reviewed by humans': '经过人工审核的新账单',
  '{n} bills in your stack': '待浏览 {n} 张账单',
  '{n} bill in your stack': '待浏览 {n} 张账单',
  'Refresh bills': '刷新账单',
  '← pass · → help': '← 跳过 · → 帮助',
  'That’s the whole stack': '这一叠看完了',
  "That's the whole stack": '这一叠看完了',
  'You have seen every bill available right now. New ones appear as they pass review — check back in a little while.':
    '你已看完当前所有账单。通过审核的新账单会陆续出现 —— 稍后再来看看。',
  'Undo still works — press Z to go back.': '撤销仍然可用 —— 按 Z 返回上一张。',
  'Could not load bills': '账单加载失败',
  'Could not load bills right now.': '暂时无法加载账单。',
  'Your impact': '你的影响力',
  'bills helped': '已帮助账单',
  'given': '已捐出',
  'Your first badge is one swipe away.': '你的第一个徽章只差一次滑动。',
  'Sign in to track your help and see your badges.': '登录后可记录你的帮助与徽章。',
  'Keyboard shortcuts': '键盘快捷键',
  'Recently passed? Undo restores the last card and removes the swipe record.':
    '刚跳过了一张？撤销会恢复卡片并删除滑动记录。',
  'Swiping records intent only — you always confirm the amount and total before paying.':
    '滑动只记录意愿 —— 付款前你总会确认金额与总额。',
  '{n} helpers': '{n} 位帮助者',
  '{n} helper': '{n} 位帮助者',
  '{n} to go': '还差 {n}',
  'Goal reached': '已达目标',
  '{n}% funded': '已筹 {n}%',
  'Due today': '今天到期',
  '{n}d left': '剩 {n} 天',
  'Not accepting help': '暂不接受帮助',
  'Fully funded': '已筹满',
  'Accepting help': '接受帮助中',
  'In review': '审核中',
  'Not approved': '未通过',
  'Suspended': '已暂停',
  'Closed': '已关闭',
  'Open details for {title}': '查看「{title}」的详情',

  // ---------------------------------------------------------------- bill detail
  'Their story': 'TA 的故事',
  'Joined {date}': '加入于 {date}',
  '{n} bills': '{n} 张账单',
  helped: '已帮助',
  active: '正常',
  restricted: '受限',
  banned: '封禁',
  admin: '管理员',
  demo: '演示',
  'No users found.': '未找到用户。',
  'User {status}': '用户状态已设为「{status}」',
  'Email verified': '邮箱已验证',
  Needed: '目标金额',
  Raised: '已筹到',
  Helpers: '帮助者',
  'Goal reached 🎉': '已达目标 🎉',
  'Between {min} and {max}. Your kindness makes a difference.': '{min} 到 {max} 之间。你的善意会带来改变。',
  '{amount} landed on "{title}". Both of you will see it in notifications.': '{amount} 已计入「{title}」。你们双方都会在通知里看到。',
  '{n}/90 characters': '{n}/90 字符',
  'Receipt preview': '凭证预览',
  'Uploading…': '上传中…',
  'Posted': '发布',
  'Due {date}': '{date} 到期',
  'Posted {when}': '发布于 {when}',
  'No confirmed help yet. The first person to step in will show up here.': '还没有确认的帮助。第一个伸手的人会出现在这里。',
  'showing latest {n}': '显示最近 {n} 条',
  'Receipt on file: {name}': '凭证已存档：{name}',
  'Uploaded {when} · {size} KB. The original stays private and is only visible to moderators; a redacted preview is shown publicly.':
    '上传于 {when} · {size} KB。原件保持私密，仅审核员可见；公开页面只显示脱敏预览。',
  'Reviewer note': '审核备注',
  Updates: '进展更新',
  'Edit bill': '编辑账单',
  'You can still edit while no help has arrived.': '尚未收到帮助前，你仍可编辑。',
  'Amounts and recipients are locked once help has been received.': '一旦收到帮助，金额与收款对象即锁定。',
  'Help this person': '帮助这个人',
  'You already helped {amount}': '你已帮助 {amount}',
  Share: '分享',
  Report: '举报',
  'Swiping or tapping Help never charges you. You confirm an exact amount, fee and total before any payment is created.':
    '滑动或点击「帮助」都不会扣款。创建任何支付前，你都会确认确切金额、手续费与总额。',
  'Bill facts': '账单信息',
  Category: '类型',
  Currency: '币种',
  'Days left': '剩余天数',
  Status: '状态',
  'How we keep this safe': '我们如何保障安全',
  'Bill unavailable': '账单不可用',
  'Could not load this bill.': '无法加载这张账单。',
  'Bill not found.': '未找到该账单。',
  'This bill may have been removed.': '这张账单可能已被移除。',
  'Back to Discover': '返回发现',
  'Loading bill…': '正在加载账单…',
  'Chose to stay anonymous': '选择匿名',
  'Sent help': '送出了帮助',
  'Link copied': '链接已复制',
  'Share it with someone who can help.': '分享给能帮上忙的人。',
  'Could not share': '分享失败',
  'Copy the address from your browser instead.': '可改用浏览器地址栏复制。',
  'Anonymous helper': '匿名帮助者',
  'Help {name}': '帮助 {name}',
  'Processing…': '处理中…',

  // ---------------------------------------------------------------- payment
  'Choose an amount': '选择金额',
  'Confirm payment': '确认支付',
  'All done': '全部完成',
  'still needed': '仍需',
  'Quick amounts': '快捷金额',
  'Custom amount': '自定义金额',
  'Between $1.00 and {max}. Your kindness makes a difference.': '范围 1.00 – {max}。你的善意很重要。',
  'The minimum help amount is 1.00.': '最低帮助金额为 1.00。',
  'Help anonymously': '匿名帮助',
  'Your name stays hidden from the bill owner and feed.': '你的名字不会出现在账单主人和社区动态中。',
  'You pay': '你将支付',
  'Continue to confirmation': '前往确认',
  'Sign in to continue': '登录后继续',
  'Nothing is charged yet. You will see the full breakdown on the next screen.': '此时尚未扣款。下一屏会显示完整明细。',
  'Super Help opens this panel first for people you want to prioritise. It still never pays automatically.':
    '超级帮助只是优先打开这个金额面板，绝不会自动付款。',
  'You are helping': '你正在帮助',
  'Help amount': '帮助金额',
  'Platform fee': '平台手续费',
  Free: '免费',
  Total: '总额',
  'Sandbox mode': '沙箱模式',
  '— this deployment simulates settlement. No card is charged, no funds move.':
    '—— 本次部署为模拟结算，不会扣款，也不会有资金流动。',
  'Sandbox wallet': '沙箱钱包',
  'Simulated · settles server-side': '模拟渠道 · 服务端结算',
  'The server verifies every payment before the bill total changes. Double-submits are ignored.':
    '账单金额变化前，服务端会校验每笔支付；重复提交会被忽略。',
  'Refunds for this build are handled by the moderation team. Bills that received help cannot be edited, closed, or re-pointed by the owner.':
    '本版本的退款由审核团队处理。已收到帮助的账单，发布者不能再修改、关闭或更改收款对象。',
  Processing: '处理中',
  'Confirming with the server…': '正在与服务端确认…',
  'Confirm {amount}': '确认支付 {amount}',
  'Change amount': '修改金额',
  'You just made someone’s day. ❤️': '你刚刚让某人的一天变好了。❤️',
  'You just made someone\'s day. ❤️': '你刚刚让某人的一天变好了。❤️',
  '{amount} landed on “{title}”. Both of you will see it in notifications.':
    '{amount} 已进入「{title}」。你们都会在通知里看到它。',
  '{n} still needed.': '还差 {n}。',
  'This bill is now fully funded.': '这张账单已筹满。',
  'View activity': '查看动态',
  'Keep swiping': '继续滑动',
  'Help confirmed': '帮助已确认',
  'Your contribution is now part of this bill.': '你的帮助已计入这张账单。',
  'Payment could not be completed.': '支付未能完成。',
  'Could not start the payment. Please try again.': '无法发起支付，请重试。',
  'Choose a reason for the report.': '请选择举报原因。',
  'Payment {id} · sandbox reference': '支付 {id} · 沙箱编号',

  // ---------------------------------------------------------------- auth
  'Welcome back': '欢迎回来',
  'Welcome back, {name}': '欢迎回来，{name}',
  'Sign in to keep swiping, track your help, or manage your bills.': '登录后可继续滑动、查看帮助记录或管理你的账单。',
  'New here?': '第一次来？',
  'Create an account': '创建账户',
  Email: '邮箱',
  Password: '密码',
  'you@example.com': '邮箱地址',
  'Your password': '你的密码',
  'kindness_inc': '善意账号',
  'Email or password is incorrect.': '邮箱或密码不正确。',
  'Show password': '显示密码',
  'Hide password': '隐藏密码',
  'Remember me': '记住我',
  'Demo admin': '演示管理员',
  'Seeded for this preview deployment only — rotate before any real launch.':
    '仅用于本预览部署 —— 正式上线前请更换。',
  'Make someone’s day': '让某人的一天好起来',
  "Make someone's day": '让某人的一天好起来',
  'One account for helping others and posting your own bill when you need a hand.':
    '一个账户，既能帮助别人，也能在自己需要时发布账单。',
  'Already have an account?': '已经有账户？',
  Username: '用户名',
  'This is public on your profile.': '该用户名会在你的主页公开。',
  '3–20 lowercase letters, numbers or underscores.': '3–20 位小写字母、数字或下划线。',
  'At least 8 characters': '至少 8 个字符',
  'Strong': '强',
  'Fair': '中',
  'Weak': '弱',
  'Back to amount': '返回金额选择',
  'Close payment panel': '关闭支付面板',
  'Account created': '账户已创建',
  'Start swiping — you can post a bill any time.': '开始滑动吧 —— 你随时可以发布账单。',
  'Already registered — try signing in.': '该邮箱已注册，请直接登录。',
  'That email is already registered.': '该邮箱已注册。',
  'Pick another one.': '换一个用户名。',
  'Use at least 8 characters.': '至少使用 8 个字符。',
  'That email looks incomplete.': '邮箱格式不完整。',
  'Something went wrong. Please try again.': '出了点问题，请重试。',
  '“I didn’t need a rescue. I needed one week of breathing room.”': '「我不需要被拯救，我只需要一周的喘息空间。」',
  'Every story on BILL SWIPE is a specific, verifiable bill — not a campaign.': 'BILL SWIPE 上的每个故事，都是一张具体、可核对的账单 —— 不是募捐活动。',
  'Receipts stay private by default': '凭证默认私密',
  'Every bill is reviewed by a human': '每张账单都有人工审核',

  // ---------------------------------------------------------------- my bills
  'Everything you have posted, from review to fully funded.': '你发布的全部账单，从审核到筹满。',
  'Bills posted': '已发布账单',
  'Raised total': '累计筹得',
  All: '全部',
  'Live': '进行中',
  'Funded': '已筹满',
  'Needs changes': '需修改',
  'No bills yet': '还没有账单',
  'Nothing in this filter': '此筛选下暂无内容',
  'When something unexpected lands, you can post the bill here and let people decide whether to help.':
    '当意外账单出现时，你可以发布在这里，让愿意的人决定是否帮助。',
  'Try another filter, or post a new bill.': '换个筛选条件，或发布新账单。',
  'Bill closed': '账单已关闭',
  'It is no longer visible in Discover.': '它已从「发现」中移除。',
  'Could not close bill': '无法关闭账单',
  'Could not load your bills.': '无法加载你的账单。',
  'of {amount}': '/ {amount}',
  'Due in {n}d': '{n} 天后到期',
  '· locked (help received)': '· 已锁定（已收到帮助）',
  View: '查看',
  Edit: '编辑',

  // ---------------------------------------------------------------- activity
  'Everything you have given — and everything that came in.': '你给出的每一份帮助，以及收到的每一份善意。',
  'Help I gave': '我给出的帮助',
  'Help I received': '我收到的帮助',
  'Total given': '累计给出',
  'Total received': '累计收到',
  Pending: '待处理',
  'No help sent yet': '还没有送出帮助',
  'When you choose to help someone, the payment and its status will show up here.':
    '当你选择帮助某人后，支付及其状态会显示在这里。',
  'Find a bill to help': '找一张可帮助的账单',
  'No help received yet': '还没有收到帮助',
  'Once someone helps one of your bills, their contribution appears here — anonymously if they chose that.':
    '当有人帮助了你的账单，这份帮助会出现在这里 —— 若对方选择匿名则显示为匿名。',
  'Refunds are processed by moderators. A refunded payment reverses the bill’s raised total — the record stays here with its new status.':
    '退款由审核团队处理。退款会回滚账单的筹款金额，记录仍会保留并更新为退款状态。',
  'Helpers who choose anonymity stay hidden from everyone except moderators handling a dispute.':
    '选择匿名的帮助者，除处理争议的审核员外对所有人隐藏。',
  'Could not load activity.': '无法加载动态。',
  Succeeded: '成功',
  Failed: '失败',
  Refunded: '已退款',
  Disputed: '争议中',

  // ---------------------------------------------------------------- profile
  'Control how you appear, how you are notified, and how you help.': '管理你的展示方式、通知偏好与帮助方式。',
  'joined {date}': '加入于 {date}',
  Achievements: '成就',
  'Earned by showing up, never by spending the most. No leaderboards here.':
    '靠持续参与获得，而不是靠花得最多。这里没有排行榜。',
  'Public profile': '公开个人主页',
  'Display name': '昵称',
  'Short bio': '一句话简介',
  'A line or two about you.': '用一两句话介绍自己。',
  Region: '地区',
  Country: '国家',
  'Coarse only — city or state. Never an address.': '只填城市或州，永远不要填详细地址。',
  'Privacy & notifications': '隐私与通知',
  'Help anonymously by default': '默认匿名帮助',
  'Pre-checks the anonymous option on every payment.': '在每笔支付时预选匿名。',
  'Let other members see your name and help stats.': '允许其他成员看到你的名字与帮助数据。',
  'Email notifications': '邮件通知',
  'Payment receipts, bill approvals and review results.': '支付回执、账单审核结果。',
  'In-app notifications': '站内通知',
  'The bell icon updates.': '铃铛图标会更新。',
  'Account security': '账户安全',
  'Current password': '当前密码',
  'New password': '新密码',
  'At least 8 characters. Signs you out everywhere.': '至少 8 个字符，会使你在所有设备退出登录。',
  'Update password': '更新密码',
  'Blocked people': '已屏蔽的人',
  Unblock: '取消屏蔽',
  Unblocked: '已取消屏蔽',
  'Profile saved': '资料已保存',
  'Could not save': '保存失败',
  'Password updated': '密码已更新',
  'Please sign in again.': '请重新登录。',
  'Could not update password': '无法更新密码',
  'Your current password is incorrect.': '当前密码不正确。',
  'first_helper': '首位帮助者',
  'kindness_starter': '善意起步',
  'helping_hand': '援助之手',
  'good_samaritan': '好撒玛利亚人',
  'community_hero': '社区英雄',

  // ---------------------------------------------------------------- community
  'Real help, as it happens. Every entry is generated from an actual payment record.':
    '真实的帮助，实时发生。每条动态都来自真实的支付记录。',
  'Includes labelled demo records seeded for this preview. No figures are fabricated beyond that.':
    '包含本预览版标注的演示记录，除此之外没有任何虚构数字。',
  'No moments yet': '还没有动态',
  'Be the first to help someone — it will show up right here.': '成为第一个伸出援手的人 —— 它会出现在这里。',
  'Could not load the feed.': '无法加载动态。',
  'Add a kind word…': '说句温暖的话…',
  'Sign in to comment': '登录后可留言',
  'Send comment': '发送留言',
  Comment: '留言',
  'Comments are rate-limited and moderated. Harassment or exposing someone’s identity gets removed.':
    '留言有频率限制并接受审核。骚扰或泄露他人身份的内容会被删除。',
  'Someone kind': '一位好心人',
  'A helper': '一位帮助者',
  'Helped': '已帮助',
  'Update': '更新',
  'View bill': '查看账单',
  '{actor} helped {owner} with {bill}': '{actor} 帮助 {owner} 支付了「{bill}」',
  '{actor} helped someone with {bill}': '{actor} 帮助某人支付了「{bill}」',
  'An anonymous helper stepped in.': '一位匿名帮助者伸出了手。',
  'A new act of kindness just landed.': '又一份善意抵达了。',
  'A contribution was refunded': '一笔帮助被退款',
  'Sign in to react': '登录后可回应',
  'Create a free account in a few seconds.': '几秒钟即可创建免费账户。',
  'Comment posted': '留言已发布',
  'Could not comment': '留言失败',
  'Mark all read': '全部标为已读',
  'All caught up': '已全部读完',
  'You are all caught up.': '你已全部读完。',
  '{n} unread': '{n} 条未读',
  'Nothing yet': '暂无通知',
  'Payment confirmations, bill approvals and updates from bills you helped will land here.':
    '支付确认、账单审核结果，以及你帮助过的账单进展都会出现在这里。',
  'Email copies are queued for the same events. Toggle them off in your profile settings.':
    '同样的事件也会排队发送邮件通知，可在个人设置中关闭。',
  Updating: '更新中',
  Unread: '未读',

  // ---------------------------------------------------------------- admin
  'Operations dashboard': '运营后台',
  'Back to app': '返回前台',
  Overview: '概览',
  Bills: '账单',
  Users: '用户',
  Payments: '支付',
  Reports: '举报',
  'Audit log': '审计日志',
  'Bills total': '账单总数',
  'Awaiting review': '待审核',
  'Live bills': '进行中账单',
  'Succeeded volume': '成功支付总额',
  'Open reports': '待处理举报',
  'Payment anomalies': '支付异常',
  '{n} demo bills are seeded in this environment and are labelled in every surface. All volumes are computed from the live database — nothing here is hardcoded.':
    '本环境预置了 {n} 张演示账单，并在各处标注。所有数字均由线上数据库实时计算，没有任何硬编码。',
  'Search title, email or username': '搜索标题、邮箱或用户名',
  'Filter by status': '按状态筛选',
  'pending review': '待审核',
  'fully funded': '已筹满',
  rejected: '已拒绝',
  suspended: '已暂停',
  closed: '已关闭',
  all: '全部',
  Approve: '通过',
  Reject: '拒绝',
  Pause: '暂停',
  Receipt: '查看凭证',
  'No bills match this filter.': '没有符合筛选条件的账单。',
  'Search by email, username or name': '按邮箱、用户名或昵称搜索',
  Restrict: '限制',
  Restore: '恢复',
  Ban: '封禁',
  'No payments yet.': '暂无支付记录。',
  'No reports. 🎉': '没有举报。🎉',
  'No admin actions yet.': '暂无管理操作记录。',
  'Reason for {status}:': '{status} 原因：',
  'Refund note (visible to the payer):': '退款说明（付款方可见）：',
  'Resolution note:': '处理说明：',
  'Refunded after review': '审核后退款',
  'Handled by admin': '由管理员处理',
  'Bill {action}d': '账单已{action}',
  'Action failed': '操作失败',
  'Refund recorded': '退款已记录',
  'Refund failed': '退款失败',
  'Report {status}': '举报已{status}',
  'Failed to load': '加载失败',
  'Failed to load bills': '账单加载失败',
  'Checking access…': '正在校验权限…',
  Refund: '退款',
  'Reason for rejection (shown to the owner)': '拒绝原因（账单主人可见）',

  // ---------------------------------------------------------------- static pages
  'How BILL SWIPE works': 'BILL SWIPE 如何运作',
  'A bill is a specific number attached to a specific person and a specific week. That is the whole product: make it visible, make helping easy, and never let a swipe quietly become a payment.':
    '一张账单，是具体的人、具体的一周、具体的一个数字。这就是产品的全部：让它被看见，让帮助变简单，并且绝不让一次滑动悄悄变成一笔付款。',
  'For people who need help': '对于需要帮助的人',
  'Pick a category, enter the exact amount, and upload the bill itself. Write what happened in your own words — the number matters less than the reason.':
    '选择类型、填写确切金额，并上传账单本身。用你自己的话写下发生了什么 —— 原因比数字更重要。',
  'A moderator reviews the document and the story before anything goes live. You can post updates afterwards so helpers see how it is going.':
    '上架前，审核员会核对凭证与故事。发布后你可以持续更新，让帮助者看到进展。',
  'Once help starts arriving, the amount and recipient lock. That protects everyone: nobody can redirect money after the fact.':
    '一旦开始收到帮助，金额与收款对象即锁定。这保护所有人：没人能在事后更改资金去向。',
  'For people who want to help': '对于想要帮助的人',
  'Discover shows one bill at a time. Swipe left to pass, right when you want to help, up for Super Help — which just opens the amount picker first.':
    '「发现」一次只展示一张账单。左滑跳过，右滑表示愿意帮助，上滑为超级帮助 —— 它只是先打开金额面板。',
  'You then choose $5, $10, $25, $50 or a custom amount, see the itemised total, and confirm. Only that confirmation creates a payment.':
    '然后你选择 5、10、25、50 美元或自定义金额，查看逐项总额并确认。只有这次确认才会创建支付。',
  'Anonymous help is one checkbox. Your name never appears to the bill owner or in the community feed.':
    '匿名帮助只需勾选一次。你的名字不会出现在账单主人或社区动态中。',
  'What happens when a bill is funded': '账单筹满后会发生什么',
  'The moment contributions reach the target, the bill flips to Fully Funded and the API rejects further payment intents for it.':
    '帮助金额一达到目标，账单立即标记为「已筹满」，接口会拒绝该账单的后续支付请求。',
  'Both the owner and every helper receive a notification. The bill stays visible for a few days so the outcome is not a mystery.':
    '账单主人与每位帮助者都会收到通知。账单会再展示几天，让结果不是个谜。',
  'Money moving between strangers is the highest-risk part of this product, so the guardrails are part of the core design rather than a later patch.':
    '陌生人之间的资金流动是本产品风险最高的部分，因此护栏是核心设计的一部分，而不是事后补丁。',
  'Before a bill goes live': '账单上架之前',
  'Every bill is human-reviewed: the uploaded document is compared against the stated amount, category and story.':
    '每张账单都有人工审核：上传的凭证会与填写的金额、类型与故事核对。',
  'Automated pre-checks flag duplicate receipts (by SHA-256 fingerprint), unusually high amounts, repeated posting, sensitive numbers typed into the story (SSN, card-like digits), and attempts to move the conversation off-platform.':
    '自动预检会标记：重复凭证（按 SHA-256 指纹）、异常金额、高频发布、故事中出现的敏感号码（身份证/卡号样式）、以及引导站外联系的行为。',
  'Flagged bills still require a human to approve them — automation never publishes anything by itself.':
    '被标记的账单仍需人工通过 —— 自动化永远不会自行发布任何内容。',
  'Sensitive data': '敏感数据',
  'Receipt originals live in private object storage and are only served to authenticated moderators, with no public caching.':
    '凭证原件存放在私有对象存储，仅向通过身份校验的审核员提供，且不做公开缓存。',
  'Public pages never expose full names, addresses, ID numbers, card numbers or medical details. Demo records are obviously labelled.':
    '公开页面绝不暴露全名、住址、证件号、银行卡号或医疗细节。演示记录都有明显标注。',
  'We ask uploaders to crop or blur anything sensitive before submitting, and we show that warning at the point of upload.':
    '我们会提示上传者在提交前裁剪或打码敏感信息，并把该提醒放在上传环节。',
  'Abuse handling': '滥用处理',
  'Reports are rate-limited and appear in the admin queue. Every moderation action — approve, reject, suspend, ban, refund, resolve report — is written to an append-only audit log with the acting admin.':
    '举报有频率限制，并进入后台队列。每一次管理操作 —— 通过、拒绝、暂停、封禁、退款、处理举报 —— 都会连同操作者写入只追加的审计日志。',
  'You can block a user; blocked people are filtered out of your Discover feed.': '你可以屏蔽某个用户；被屏蔽者会从你的「发现」中过滤掉。',
  'Commenting is rate-limited and moderated; harassment or doxxing is removed.': '留言有频率限制并受审核；骚扰或人肉信息会被删除。',
  'Payments & the sandbox': '支付与沙箱',
  'This deployment runs in Payment Sandbox mode. It exercises the full payment state machine without moving any real money — and it says so everywhere it matters.':
    '本次部署运行在「支付沙箱」模式：走完整的支付状态机，但不涉及任何真实资金 —— 并且在所有关键位置如实标注。',
  'What actually happens': '实际发生了什么',
  'Choosing an amount creates a payment intent on the server with status Pending. The client receives an idempotency key so a double tap cannot create two payments.':
    '选择金额会在服务端创建状态为「待处理」的支付意图。客户端持有幂等键，因此连点两次也不会生成两笔支付。',
  'Confirming calls a server endpoint that settles the intent. The server — not the browser — then updates the payment to Succeeded, writes a help record, and increments the bill total inside a single transaction.':
    '确认时会调用服务端接口结算该意图。由服务端（而不是浏览器）将支付更新为「成功」、写入帮助记录，并在同一事务内累加账单金额。',
  'The UI reflects the server response. It never marks a payment as successful on its own.': '界面只反映服务端结果，绝不会自行标记支付成功。',
  'Switching to a real provider': '切换到真实渠道',
  'The payment layer is isolated behind a provider abstraction. Adding Stripe means: set PAYMENT_MODE=stripe, add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET, and implement the webhook route that calls the same settle function after signature verification.':
    '支付层被隔离在渠道抽象之后。接入 Stripe 意味着：设置 PAYMENT_MODE=stripe，配置 STRIPE_SECRET_KEY 与 STRIPE_WEBHOOK_SECRET，并实现验签后再调用同一结算函数的 webhook 路由。',
  'No frontend logic changes. The client never sees a secret and never decides the outcome.': '前端逻辑无需改动。客户端看不到任何密钥，也不决定支付结果。',
  'Until that is configured and legally reviewed, this build must stay in sandbox mode. It must not be used to collect real money.':
    '在完成配置与合规审查之前，本版本必须保持沙箱模式，不得用于收取真实资金。',
  'Refunds and disputes': '退款与争议',
  'Refunds are a moderator action: the payment moves to Refunded and the bill total is decremented in the same transaction, so totals can never drift.':
    '退款是管理员操作：支付转为「已退款」，账单金额在同一事务中回退，因此总额永远不会错账。',
  'Bills that received any payment cannot be closed or edited by their owner — this prevents post-hoc bait and switch.':
    '收到过任何支付的账单，发布者不能再关闭或修改 —— 以防止事后偷换。',
  'Frequently asked questions': '常见问题',
  'Short answers to the things people ask before trusting a stranger with a bill.': '在你决定为陌生人的账单伸出援手前，最常被问到的几个问题。',
  'Does swiping right charge me?': '右滑会扣我的钱吗？',
  'No. A swipe only records intent and opens the amount picker. You confirm an exact amount, fee and total before a payment is created.':
    '不会。滑动只记录意愿并打开金额选择。创建支付前，你会确认确切金额、手续费与总额。',
  'Is this handling real money today?': '现在处理的是真实资金吗？',
  'Not in this deployment. Payment Sandbox mode is active and every payment is labelled as a sandbox transaction.':
    '本次部署不是。当前为支付沙箱模式，每笔支付都标记为沙箱交易。',
  'Who sees my receipt?': '谁会看到我的凭证？',
  'You and the moderation team. Originals are private; the public page shows at most a redacted preview.':
    '你和审核团队。原件私密，公开页面最多显示脱敏预览。',
  'Can I help anonymously?': '我可以匿名帮助吗？',
  'Yes — either per payment or as a default in your profile. Moderators can still see the record if there is a dispute.':
    '可以 —— 可以逐笔选择，也可以在个人设置里设为默认。如有争议，审核员仍可查看记录。',
  'What stops someone from posting a fake bill?': '如何阻止有人发布假账单？',
  'Human review plus automated duplicate-receipt detection, amount anomaly checks and report-driven re-review. No system is perfect; that is why reports are one tap away.':
    '人工审核，加上重复凭证检测、金额异常检查与举报触发的复审。没有系统是完美的，所以举报只需一次点击。',
  'Why no leaderboards?': '为什么没有排行榜？',
  'Ranking people by generosity turns kindness into a scoreboard. Achievements here track presence, not spending.':
    '按慷慨程度排名，会把善意变成记分板。这里的成就只记录参与，不衡量支出。',
  'About this project': '关于这个项目',
  'BILL SWIPE is an open-source product experiment: can a swipe-based interface make micro-giving to strangers feel natural without making it careless?':
    'BILL SWIPE 是一个开源的产品实验：基于滑动的界面，能否让对陌生人的小额帮助变得自然，而又不至于轻率？',
  'What is real here': '哪些是真实的',
  'The application is fully functional: accounts, sessions, bill authoring with private receipt storage, moderation queue, atomic fund accounting, notifications, reporting, blocking, and an admin dashboard with an audit trail.':
    '应用完全可用：账户、会话、带私有凭证存储的账单发布、审核队列、原子化资金记账、通知、举报、屏蔽，以及带审计日志的后台。',
  'It runs on Cloudflare Workers with SQLite-backed Durable Objects and R2 for private documents, so the whole stack deploys without extra services.':
    '它运行在 Cloudflare Workers 上，使用 SQLite 版 Durable Object 与 R2 私有存储，整栈部署无需额外服务。',
  'Demo bills and demo helpers are seeded and labelled; community statistics are computed from the database, not invented.':
    '演示账单与演示帮助者都已预置并标注；社区统计由数据库实时计算，而非编造。',
  'What is intentionally not real': '哪些是刻意不真实的',
  'Payments are sandboxed. No card network is contacted, no money moves, and the UI says so on the confirmation screen and in the footer.':
    '支付处于沙箱。不会接触任何卡组织，不会有资金流动，界面在确认页与页脚都如实说明。',
  'Identity verification is out of scope for this build. Before a real launch you would add KYC or a compliant provider that handles it.':
    '本版本不含身份核验。正式上线前需要接入 KYC，或交由合规渠道处理。',
  'Follow along': '关注进展',
  'The author posts progress, screenshots and product notes on X. Feedback and issues are welcome — this is meant to be read and forked.':
    '作者会在 X 上发布进展、截图与产品笔记。欢迎反馈与提 issue —— 这个项目就是给人读、给人 fork 的。',
  'Browse bills': '浏览账单',
  'Swipe to discover': '滑动发现',
  'Private receipts': '私有凭证',
  'No leaderboards': '没有排行榜',
  'Follow @0xkillcoin on X': '在 X 上关注 @0xkillcoin',
  'Sandbox active.': '沙箱运行中。',
  'Payment sandbox build.': '支付沙箱版本。',

  // ---------------------------------------------------------------- post wizard
  'Edit your bill': '编辑账单',
  'Step {step} of {total}': '第 {step} 步 / 共 {total} 步',
  'Specific beats dramatic. Tell people exactly what the money covers and upload the document that shows it.':
    '具体比夸张更重要。请说明这笔钱的用途，并上传能够佐证的单据。',
  'Step {n} of 5': '第 {n} 步 / 共 5 步',
  Details: '信息',
  Story: '故事',
  Review: '预览',
  'What kind of bill is it?': '这是哪一类账单？',
  'Pick the closest match — it helps people find your story.': '选择最接近的一类，方便别人找到你的故事。',
  'The basics': '基本信息',
  'Be concrete: what is the bill for, how much, and by when?': '尽量具体：这笔钱用于什么、多少、什么时候需要？',
  'Bill title': '账单标题',
  'Groceries for the week until my first paycheck': '发第一笔工资前这周的食品杂货',
  'Amount needed': '所需金额',
  'Already paid (optional)': '已自付金额（可选）',
  'Money you already put toward this bill.': '你自己已经支付的部分。',
  'Due date (optional)': '截止日期（可选）',
  'Where should help go? (optional)': '帮助如何转给你？（可选）',
  '@handle, bank reference, or leave blank': '@用户名、转账备注，或留空',
  'Shown only to moderators. Never collect card numbers here.': '仅审核员可见。切勿填写银行卡号。',
  'Still needed': '仍需金额',
  'Upload the bill': '上传账单凭证',
  'A screenshot or photo of the actual bill. JPG, PNG, WEBP or PDF up to 8 MB.': '账单本身的截图或照片，支持 JPG / PNG / WEBP / PDF，最大 8 MB。',
  'Cover up sensitive details first.': '请先遮挡敏感信息。',
  'Blur or crop ID numbers, card numbers, full home addresses, and medical specifics. Originals are visible only to moderators — but never upload what you would not want a stranger to see by mistake.':
    '请打码或裁剪证件号、银行卡号、完整住址与医疗细节。原件仅审核员可见 —— 但也请不要上传任何你不希望被陌生人误看到的内容。',
  'Tap to choose a file': '点击选择文件',
  'or drag it in on desktop': '桌面端可直接拖入',
  'Replace file': '更换文件',
  Uploading: '上传中',
  'stored privately': '已私有保存',
  'not saved yet': '尚未保存',
  'Unsupported file': '不支持的文件',
  'Use JPG, PNG, WEBP or PDF.': '请使用 JPG / PNG / WEBP / PDF。',
  'File too large': '文件过大',
  'Receipts must be under 8 MB.': '凭证需小于 8 MB。',
  'Receipt uploaded': '凭证已上传',
  'The original stays private.': '原件保持私密。',
  'Upload failed': '上传失败',
  'Please try again.': '请重试。',
  'You can submit without a receipt, but bills with a clear document are approved far more often.':
    '没有凭证也可以提交，但有清晰单据的账单通过率高得多。',
  'Tell your story': '讲讲你的故事',
  'People connect with people, not just numbers. What happened, why you need help, and how the money will be used.':
    '人与人是靠故事连接的，不只是数字。发生了什么、为什么需要帮助、这笔钱将如何使用。',
  '{n} words · {length}/2000 characters': '{n} 个词 · {length}/2000 字符',
  'Minimum 60 characters': '至少 60 字符',
  'One or two sentences of context.': '一两句话交代背景。',
  'Show how the total adds up.': '说明总额是如何构成的。',
  'What changes once it is covered.': '付清之后会有什么不同。',
  'I just started a new job, but my first paycheck won’t arrive until next week. Between rent and bus fare there is nothing left for food…':
    '我刚开始一份新工作，但要到下周才能领到第一笔工资。付完房租和车费后，已经没有钱买食物了……',
  'words': '个词',
  '{n}/2000 characters': '{n}/2000 字符',
  'What happened?': '发生了什么？',
  'Why this amount?': '为什么是这个金额？',
  'How will it help?': '这笔钱能带来什么改变？',
  'Review before submitting': '提交前预览',
  'A moderator reviews every bill before it appears in Discover.': '每张账单在进入「发现」前都会由审核员核对。',
  'Pending review': '待审核',
  'Receipt attached': '已附凭证',
  'No receipt': '无凭证',
  'Untitled bill': '未命名账单',
  'Asking for': '求助金额',
  'You can edit this bill until it receives its first payment.': '在收到第一笔帮助前，你仍可编辑此账单。',
  'Once help arrives, the amount and recipient are locked.': '一旦收到帮助，金额与收款对象即锁定。',
  'You can post updates so helpers see how it is going.': '你可以发布更新，让帮助者看到进展。',
  'Submit for review': '提交审核',
  'Skip without a receipt?': '要不上传凭证直接继续？',
  'Never publish ID numbers, card numbers, full addresses, or medical records. Public pages show a redacted preview only.':
    '切勿公开证件号、银行卡号、完整住址或医疗记录。公开页面只展示脱敏预览。',
  'Safety guidelines': '安全指南',
  Discard: '放弃',
  'Bill submitted': '账单已提交',
  'A moderator will review it shortly.': '审核员会尽快处理。',
  'Bill updated': '账单已更新',
  'It is back in the review queue.': '已重新进入审核队列。',
  'Could not submit the bill. Please try again.': '无法提交账单，请重试。',
  'This bill can no longer be edited': '这张账单已无法编辑',
  'Amounts lock once help has been received.': '收到帮助后金额即锁定。',
  'Could not load this bill': '无法加载该账单',
  'Food & Groceries': '食品杂货',
  'Rent & Housing': '房租居住',
  Medical: '医疗',
  Education: '教育',
  Groceries: '食品杂货',
  Utilities: '水电燃气',
  Transportation: '交通',
  Emergency: '紧急支出',
  Other: '其他',
  Rent: '房租',
  Transport: '交通',
  'Keeping a roof overhead.': '让屋顶继续在头上。',
  'Treatment, meds, recovery.': '治疗、药物、康复。',
  'Books, tuition, a fresh start.': '书本、学费、新的开始。',
  'Putting food on the table.': '让餐桌上有饭。',
  'Power, water, heat.': '电、水、暖气。',
  'Getting where you need to be.': '去你该去的地方。',
  'The unplanned, uninvited.': '计划之外的意外。',
  'Life, in all its shapes.': '生活的各种样子。',

  // ---------------------------------------------------------------- system / errors
  'You appear to be offline. Check your connection and try again.': '看起来你离线了，请检查网络后重试。',
  'Please sign in to continue.': '请先登录。',
  'Admin access required.': '需要管理员权限。',
  'Too many requests — please slow down a moment.': '请求过于频繁，请稍等片刻。',
  'Something went wrong on our side. Please try again.': '我们这边出了点问题，请重试。',
  'This page could not be found.': '找不到这个页面。',
  'This bill does not exist': '这张账单不存在',
  'Go to Discover': '前往发现',
  Home: '首页',
  'Or read what people have been helping with →': '或者看看大家都在帮什么 →',
  'Report this {type}': '举报该{type}',
  'Details (optional)': '补充说明（可选）',
  'Anything we should know?': '有什么需要告诉我们的？',
  'Send report': '提交举报',
  Reason: '原因',
  'Report sent': '举报已提交',
  'Our moderators will review this shortly.': '审核团队会尽快处理。',
  'Could not send the report.': '举报提交失败。',
  'Fake or stolen receipt': '凭证造假或盗用',
  'Story does not match the bill': '故事与账单不符',
  'Duplicate listing': '重复发布',
  'Requests off-platform payment': '要求站外付款',
  'Abusive or harassing content': '辱骂或骚扰内容',
  'Sensitive personal data exposed': '暴露敏感个人信息',
  'Something else': '其他原因',
  bill: '账单',
  user: '用户',
  comment: '留言',
  'First Helper': '首位帮助者',
  'Kindness Starter': '善意起步',
  'Helping Hand': '援助之手',
  'Good Samaritan': '好撒玛利亚人',
  'Community Hero': '社区英雄',
  'You helped someone for the first time.': '你第一次帮助了别人。',
  'Help 3 different bills.': '帮助 3 张不同的账单。',
  'Help 10 bills on your way.': '累计帮助 10 张账单。',
  'Spread help across 4 different bill categories.': '把帮助分散到 4 个不同账单类型。',
  'Reach 25 helps — no money ranking, just presence.': '累计帮助 25 次 —— 不比金额，只看在场。',
  Approved: '已通过',
  Draft: '草稿',
  '{n} reports': '{n} 条举报',
  '{n} report': '{n} 条举报',
  "Someone's bill. Someone's kindness. Swipe to discover real stories, then choose to help — never automatically.":
    '一张账单，一份善意。滑动发现真实故事，帮助永远由你决定 —— 绝不自动扣款。',
  'BILL SWIPE Team': 'BILL SWIPE 团队',
  'Undo still works — press': '撤销仍然可用 —— 按',
  'to go back.': '返回。',
  'Total due': '应付总额',
  REF: '编号',
  'Rent statement': '房租账单',
  'Medical statement': '医疗账单',
  Invoice: '发票',
  'Grocery receipt': '购物小票',
  'Utility bill': '水电账单',
  'Repair estimate': '维修报价',
  'Service invoice': '服务发票',
  'Monthly rent': '月租',
  Parking: '停车费',
  'Late fee waiver': '滞纳金减免',
  'Utilities share': '公用事业分摊',
  Consultation: '诊疗费',
  Treatment: '治疗费',
  Prescription: '处方药费',
  'Lab work': '化验费',
  'Tuition balance': '学费余额',
  'Course materials': '课程教材',
  'Lab fee': '实验费',
  Registration: '注册费',
  'Produce & dairy': '果蔬与乳品',
  'Pantry staples': '主食杂货',
  Household: '日用百货',
  'Weekly shop': '每周采购',
  Electricity: '电费',
  'Water & sewer': '水与排污',
  Heating: '暖气费',
  'Service charge': '服务费',
  Parts: '配件',
  Labour: '工时费',
  Diagnostics: '检测费',
  'Safety inspection': '安全检验',
  'Call-out fee': '上门费',
  Materials: '材料费',
  Disposal: '清运费',
  Service: '服务',
  Adjustment: '调整项',
  'Maple Court Apartments': '枫庭公寓',
  'Riverside Rentals': '河畔租赁',
  'Harbor View Homes': '港湾之家',
  'Northside Clinic': '北区分诊部',
  'Bay Medical Center': '海湾医疗中心',
  'Family Health Group': '家庭健康集团',
  'City College Bookstore': '城市学院书店',
  'Lincoln High School': '林肯高中',
  'State University': '州立大学',
  'Fresh Market': '新鲜市集',
  'Corner Grocery Co.': '街角杂货',
  'Green Basket Foods': '绿篮食品',
  'Metro Power & Light': '都会电力',
  'Clearwater Utilities': '清水公用事业',
  'City Gas Service': '城市燃气',
  'Reliable Auto Repair': '可靠汽修',
  'Transit Authority': '交通管理局',
  'Midtown Bike Works': '中城单车工坊',
  'QuickFix Services': '快修服务',
  'Emergency Home Repair': '紧急家居维修',
  'Community Aid Office': '社区援助站',
  'Local Services': '本地服务',
  'City Office': '市政窗口',
  'Community Support': '社区支持',
  'Renewal fee': '续期费',
  '{amount} to go': '还差 {amount}',
  'Groceries until my first paycheck lands': '发工资前先撑过这周的采买',
  'Six more physical therapy sessions': '还差六次物理治疗',
  'February rent while I recover': '养伤期间的二月房租',
  'Kind Neighbor': '好邻居',
  'Quiet Giver': '默默相助',
  'Someone kind helped someone with a bill': '一位好心人帮助了某人支付账单',
  'A community update': '一条社区动态',
  'A member’s bill': '某位成员的账单',
  'Someone kind helped {owner} with {bill}': '一位好心人帮助 {owner} 支付了「{bill}」',
  'Good luck — rooting for you.': '祝你好运 —— 我支持你。',
  'Small thing, but I have been there.': '不多，但我也经历过。',
  'This story stayed with me. Sending what I can.': '这个故事让我记挂，我尽我所能。',
  'Payday came through, so here you go.': '发薪日到了，拿去用吧。',
  'No one should have to choose between food and bus fare.': '没人该在吃饭和坐车之间做选择。',
  'Adding a little. Wish it were more.': '添一点，希望多些。',
  'This is what the internet should be for.': '互联网本就该用来做这个。',
  'Sent a little. Hope it helps!': '送了一点，希望能派上用场！',
  'Reading this made my morning better.': '读到这个，我的一天都变好了。',
  'Been there. Hang in there.': '我也经历过，撑住。',
  'Comments are rate-limited and moderated. Harassment or exposing someone\'s identity gets removed.': '留言有频率限制并接受审核。骚扰或泄露他人身份的内容会被删除。',
  'No real payment provider is configured. Do not use this deployment to collect money.': '未配置真实支付渠道。请勿使用本部署收取资金。',
  'The page you were looking for moved, closed, or never existed. There are still plenty of real bills waiting.': '你要找的页面已移动、关闭，或从未存在。还有很多真实账单在等待。',
  'By joining you agree to keep this place kind. We never sell your data, and anonymous help is always available.': '加入即表示你愿意保持这里的友善。我们绝不出卖你的数据，匿名帮助始终可用。',
};

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (source: string, vars?: Record<string, string | number>) => string;
  tp: (count: number, one: string, many: string) => string;
  num: (value: number) => string;
  money: (minor: number, currency?: string) => string;
  date: (iso?: string | null) => string;
  timeAgo: (iso: string) => string;
  langLabel: string;
}

/**
 * Lookup index that ignores typographic differences between the source copy and
 * the dictionary entry (curly vs straight quotes, en/em dashes, whitespace).
 */
const NORMALISED_ZH: Map<string, string> = new Map(
  Object.entries(zh).map(([key, value]) => [normaliseKey(key), value]),
);

export function normaliseKey(input: string): string {
  return input
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Exposed for tests and tooling (translation coverage checks). */
export const dictionary: Readonly<Record<string, string>> = zh;

export function lookUp(source: string, lang: Lang): string {
  if (lang !== 'zh') return source;
  return zh[source] ?? NORMALISED_ZH.get(normaliseKey(source)) ?? source;
}

const I18nContext = createContext<I18nValue | null>(null);

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  );
}

function detectInitialLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  if (stored === 'zh' || stored === 'en') return stored;
  const nav = navigator.language?.toLowerCase() ?? '';
  return nav.startsWith('zh') ? 'zh' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      /* private mode may reject writes */
    }
    // Best-effort sync with the account so other devices follow along.
    void fetch('/api/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locale: next }),
      credentials: 'same-origin',
    }).catch(() => undefined);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const t = (source: string, vars?: Record<string, string | number>) => {
      if (lang !== 'zh') return interpolate(source, vars);
      // Copy in the JSX sometimes uses curly quotes; entries may use straight
      // ones. Normalise both directions so a single entry covers them.
      const direct = zh[source];
      if (direct !== undefined) return interpolate(direct, vars);
      const fallback = NORMALISED_ZH.get(normaliseKey(source));
      if (fallback !== undefined) return interpolate(fallback, vars);
      return interpolate(source, vars);
    };

    const tp = (count: number, one: string, many: string) => {
      if (lang === 'zh') return t(many, { n: count });
      return t(count === 1 ? one : many, { n: count });
    };

    const localeTag = lang === 'zh' ? 'zh-CN' : 'en-US';

    const date = (iso?: string | null) => {
      if (!iso) return '—';
      const value = new Date(iso);
      if (Number.isNaN(value.getTime())) return '—';
      return value.toLocaleDateString(localeTag, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const timeAgo = (iso: string) => {
      const then = new Date(iso).getTime();
      if (Number.isNaN(then)) return '';
      const diff = Date.now() - then;
      const minutes = Math.round(diff / 60000);
      if (minutes < 1) return t('just now');
      if (minutes < 60) return t('{n}m ago', { n: minutes });
      const hours = Math.round(minutes / 60);
      if (hours < 24) return t('{n}h ago', { n: hours });
      const days = Math.round(hours / 24);
      if (days < 7) return t('{n}d ago', { n: days });
      const weeks = Math.round(days / 7);
      if (weeks < 5) return t('{n}w ago', { n: weeks });
      return date(iso);
    };

    return {
      lang,
      setLang,
      t,
      tp,
      num: (input: number) => input.toLocaleString(localeTag),
      money: (minor: number, currency = 'USD') => formatMoney(minor, currency),
      date,
      timeAgo,
      langLabel: lang === 'zh' ? '中文' : 'EN',
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

/** Marks a string for the translation audit without changing behaviour. */
export function translated(source: string): string {
  return source;
}
