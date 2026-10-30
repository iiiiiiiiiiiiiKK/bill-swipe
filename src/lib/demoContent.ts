import { useI18n } from './i18n';

/**
 * Demo fixtures are part of the product, not user content, so they are shipped
 * in both languages. Keyed by the English title produced by the seed data.
 *
 * Real member posts are never translated — they appear exactly as written.
 */
interface DemoCopy {
  title: string;
  story: string;
}

const DEMO_ZH: Record<string, DemoCopy> = {
  'Groceries for the week until my first paycheck': {
    title: '发第一次工资前，这周的食品杂货',
    story:
      '我刚在医院开始新工作，但第一笔工资要到下周五才到账。交完房租和公交卡，这周连买菜的钱都没有了。我七岁和四岁的两个孩子觉得「晚饭吃麦片」是场冒险，我也尽量让他们这么以为。这笔钱会变成一次真正的采购：牛奶、鸡蛋、米、水果，还有足够撑到发薪日的意面。',
  },
  'Physical therapy sessions after knee surgery': {
    title: '膝盖手术后的物理治疗',
    story:
      '三月搬货时我撕裂了韧带。手术很顺利，但保险只批了四次物理治疗，而我要做十二次才能被判定可以复工。剩下的我自己掏钱，现在还差三次就能做完。能无痛走路意味着能回去上班，也意味着其他一切都能慢慢补上。',
  },
  'Final semester textbook and exam fees': {
    title: '最后一学期的教材与考试费',
    story:
      '距离护理学位毕业还有三周。最后一个学期把积蓄全掏空了，实习那一年又没有收入。我需要两本教材和执照考试的报名费。我已经每周在咖啡馆打工二十小时，比起放弃一门课，我更愿意开口求助 —— 毕竟都走到这里了。',
  },
  'February rent while I recover from a burn injury': {
    title: '烫伤恢复期间的二月房租',
    story:
      '餐厅里一锅热油溅到我身上，让我四周不能上工。厨房说我一旦康复就立刻恢复班次，但房租不等我。女儿每隔一周的周末会来住，我不想让她听到我们可能要失去这个家的消息。房租是 950，我卖掉工具攒了 380，剩下的想请大家帮一把。',
  },
  'Winter coat, boots and heating for my first Canadian winter': {
    title: '第一个加拿大冬天的大衣、靴子和暖气费',
    story:
      '我从一个从没低过 20°C 的城市搬来。第一个加拿大冬天已经到了，而我只有一件薄外套。奖学金覆盖学费和合租房，但不包括大衣、雪靴和额外的取暖电费。我仔细算过：大衣 120，靴子 60，其余是两个月的取暖费。在家我穿两双袜子，说实话，我有点怕二月。',
  },
  'Wheelchair ramp so my sister can come home': {
    title: '为妹妹修一条轮椅坡道，让她能回家',
    story:
      '我妹妹 Dana 在康复中心住了五个月。计划是春天让她回到我这里，但家门口有三级台阶，而她坐轮椅。坡道必须按规范施工，我问了三家报价：光材料就是 680。今年的积蓄都花在医院停车费上了。报价单我已经附上 —— 我只要装修师傅写下的那个数。',
  },
  'School supplies and uniform for my son': {
    title: '儿子的学习用品与校服',
    story:
      '儿子这周升四年级，一个暑假长了十公分，去年的整套校服现在谁也穿不上。我打两份工 —— 早上在药房，晚上在餐厅 —— 但开学季总是撞在最难的时候。这笔钱用于一套校服、一双新鞋，以及老师发来的标准文具清单。不多要。',
  },
  'Bond and first month rent for a small studio': {
    title: '小单间的押金与首月房租',
    story:
      '六周前我为了工作搬到墨尔本，一直睡在朋友家的沙发上。终于找到一间负担得起的单间，但它要求四周押金加首月房租一次付清。我没有能帮忙的家人，积蓄都花在搬家上了。我有一份签好的工作合同 —— 这只是现金流的时间差，不是稳定性问题，我只需要一座桥搬进去。',
  },
  'Two months of invoices that never got paid': {
    title: '两个月没结的稿费',
    story:
      '一个客户七月注销了公司，我九月才知道，连带六千块未付的发票。自由职业意味着没有失业保险。十月起我有新项目，但眼前这段空档是真实的：电话费、网费（我得靠它工作），还有吃饭。能砍的我已经全砍了。这是实际的数，如果情况有变我会如实说明。',
  },
  'Repair for the bike that pays my rent': {
    title: '修好那辆养活我的自行车',
    story:
      '送单路上后轮裂了，顺带把飞轮也带走了。没有车我就丢了这份工作 —— 它不是爱好，是我全部的收入来源。车行给了报价：新轮组、飞轮，加一次安全保养。我借了朋友的备用车，只能用一周，之后就还回去。如果能在周末前修好，我就能重新开工。',
  },
  'Assisted living deposit for my grandmother': {
    title: '外婆入住护理院的押金',
    story:
      '这两年我一边全职上班，一边在家照顾外婆，而她在我上班时独自在家已经不安全了。护理院有床位，但需要先付一笔押金。我卖了车，已经凑到一半。是她把我养大的，我希望她白天身边有人，而不是对着安静客厅和一台电视。',
  },
  "Dental work I've postponed for two years": {
    title: '拖了两年的牙科治疗',
    story:
      '那颗裂开的磨牙我拖了两年，因为公司的牙科保险只覆盖洗牙，其他几乎不报。从酸到疼，再到现在一直跳着疼，医生说这颗牙可能保不住了。报价包含根管治疗和牙冠。再拖下去，价格更高，牙也没了。孩子的预约总是排在前面。这次我为自己开口。',
  },
  'Starter tool kit for my electrical apprenticeship': {
    title: '电工学徒的入门工具套装',
    story:
      '我被工会的学徒计划录取了 —— 第一份真正的职业。第一天报到必须自带手工具、万用表和钢头工作靴。清单很具体，总额 480。我在五金店上班已经在攒钱，但还差一截。这些工具我会用很多年。这真的是最后一块拼图了。',
  },
  'Furnace repair before the first freeze': {
    title: '第一场霜降前修好暖气炉',
    story:
      '上周二暖气炉停了，维修公司查出热交换器开裂。我在初中教合唱，收入谈不上宽裕，但让我害怕的是那张报价：五百八十。妈妈和我一起住，她七十八岁。我现在用两台电暖器给她卧室保温，电费单会很难看。这件事之后我会开始分期把剩下的还上。',
  },
  'Van transmission repair to keep my deliveries': {
    title: '修变速箱，保住我的配送工作',
    story:
      '这辆面包车就是我的工作。没有它我接不了线路，而我又没钱一边租车一边攒维修费 —— 这就是死结。变速箱店给了大修报价，我借了别人的车开了两周，周五就得还。我在这座城市跑了九年配送。只要能修好，修完当天我就能开工。',
  },
  'Deposit for a safer apartment for me and my daughter': {
    title: '给女儿换一个更安全的小家',
    story:
      '我们住的那栋楼后门锁坏了，我跟房东提了四次。我找到两条街外一间更小的房子，月租还更便宜，但押金是那道墙。我每天早上在员工上班前打扫两间办公室 —— 九年没缺过一天。女儿九岁。我希望她晚上能安心睡觉，而不是看着我一次次去检查门锁。',
  },
};

/** Pure variant for use inside data-loading code. */
export function localizeDemoBill<T extends { title: string; isDemo?: boolean; story?: string; excerpt?: string }>(
  bill: T,
  lang: 'en' | 'zh',
): T {
  if (lang !== 'zh' || !bill.isDemo) return bill;
  const entry = DEMO_ZH[bill.title];
  if (!entry) return bill;
  const next: T = { ...bill, title: entry.title };
  if (typeof bill.story === 'string') next.story = entry.story;
  if (typeof bill.excerpt === 'string') next.excerpt = entry.story.slice(0, 150);
  return next;
}

export function useBillCopy() {
  const { lang } = useI18n();
  return <T extends { title: string; isDemo?: boolean; story?: string; excerpt?: string }>(bill: T): T => {
    if (lang !== 'zh' || !bill.isDemo) return bill;
    const entry = DEMO_ZH[bill.title];
    if (!entry) return bill;
    const next: T = { ...bill, title: entry.title };
    if (typeof bill.story === 'string') next.story = entry.story;
    if (typeof bill.excerpt === 'string') next.excerpt = entry.story.slice(0, 150);
    return next;
  };
}

/** Translate a demo bill title that arrives without the full bill object. */
export function useDemoTitle() {
  const { lang, t } = useI18n();
  return (title: string | null | undefined): string => {
    if (!title) return '';
    if (lang !== 'zh') return t(title);
    return DEMO_ZH[title]?.title ?? t(title);
  };
}
