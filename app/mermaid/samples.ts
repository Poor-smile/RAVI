export type MermaidSample = {
  id: string;
  category: string;
  title: string;
  description: string;
  docsUrl: string;
  code: string;
};

export const DEFAULT_MERMAID_CODE = `flowchart RL
    start([شروع]) --> review{نیاز به بازبینی؟}
    review -->|بله| edit[ویرایش سند]
    edit --> review
    review -->|خیر| done([انتشار])`;

export const MERMAID_SAMPLES: MermaidSample[] = [
  {
    id: "flowchart",
    category: "پایه",
    title: "فلوچارت",
    description: "نمایش مسیر، تصمیم و فرایند.",
    docsUrl: "https://mermaid.js.org/syntax/flowchart.html",
    code: DEFAULT_MERMAID_CODE,
  },
  {
    id: "sequence",
    category: "پایه",
    title: "توالی",
    description: "گفت‌وگوی زمان‌مند میان نقش‌ها.",
    docsUrl: "https://mermaid.js.org/syntax/sequenceDiagram.html",
    code: `sequenceDiagram
    participant کاربر
    participant راوی
    کاربر->>راوی: فایل را باز کن
    راوی-->>کاربر: پیش‌نمایش آماده است`,
  },
  {
    id: "class",
    category: "مهندسی",
    title: "کلاس",
    description: "ساختار کلاس‌ها و رابطهٔ میان آن‌ها.",
    docsUrl: "https://mermaid.js.org/syntax/classDiagram.html",
    code: `classDiagram
    class سند {
      +String نام
      +ذخیره()
    }
    class نمودار {
      +String کد
      +رندر()
    }
    سند "1" *-- "*" نمودار`,
  },
  {
    id: "state",
    category: "مهندسی",
    title: "حالت",
    description: "چرخهٔ حالت‌های یک فرایند.",
    docsUrl: "https://mermaid.js.org/syntax/stateDiagram.html",
    code: `stateDiagram-v2
    [*] --> پیش_نویس
    پیش_نویس --> بازبینی
    بازبینی --> منتشر_شده
    بازبینی --> پیش_نویس`,
  },
  {
    id: "er",
    category: "مهندسی",
    title: "رابطهٔ موجودیت",
    description: "مدل داده و نسبت موجودیت‌ها.",
    docsUrl: "https://mermaid.js.org/syntax/entityRelationshipDiagram.html",
    code: `erDiagram
    DOCUMENT ||--o{ DIAGRAM : contains
    DOCUMENT {
      string name
      string format
    }
    DIAGRAM {
      string source
      string theme
    }`,
  },
  {
    id: "requirement",
    category: "مهندسی",
    title: "نیازمندی",
    description: "ردیابی نیازمندی و اجزای سیستم.",
    docsUrl: "https://mermaid.js.org/syntax/requirementDiagram.html",
    code: `requirementDiagram
    requirement readability {
      id: 1
      text: "متن و نمودار خوانا باشند"
      risk: low
      verifymethod: test
    }
    element preview {
      type: component
    }
    preview - satisfies -> readability`,
  },
  {
    id: "architecture",
    category: "مهندسی",
    title: "معماری",
    description: "سرویس‌ها، گروه‌ها و اتصال‌های معماری.",
    docsUrl: "https://mermaid.js.org/syntax/architecture.html",
    code: `architecture-beta
    group app(cloud)["راوی"]
    service editor(server)["ویرایشگر"] in app
    service preview(internet)["پیش نمایش"] in app
    editor:R -- L:preview`,
  },
  {
    id: "c4",
    category: "مهندسی",
    title: "C4",
    description: "نمای زمینهٔ سامانه و کاربران.",
    docsUrl: "https://mermaid.js.org/syntax/c4.html",
    code: `C4Context
    title زمینه سامانه راوی
    Person(reader, "خواننده", "مطالعه و حاشیه نویسی")
    System(raavi, "راوی", "ویرایشگر Markdown")
    Rel(reader, raavi, "استفاده می کند")`,
  },
  {
    id: "gantt",
    category: "برنامه‌ریزی",
    title: "گانت",
    description: "زمان‌بندی کارها و نقاط عطف.",
    docsUrl: "https://mermaid.js.org/syntax/gantt.html",
    code: `gantt
    title برنامه انتشار
    dateFormat YYYY-MM-DD
    section طراحی
    نمونه اولیه :done, a1, 2026-07-01, 5d
    section توسعه
    پیاده سازی :active, a2, after a1, 8d`,
  },
  {
    id: "timeline",
    category: "برنامه‌ریزی",
    title: "خط زمانی",
    description: "رویدادها در امتداد زمان.",
    docsUrl: "https://mermaid.js.org/syntax/timeline.html",
    code: `timeline
    title مسیر سند
    پیش نویس : نوشتن
    بازبینی : دریافت نظر
    انتشار : اشتراک فایل`,
  },
  {
    id: "kanban",
    category: "برنامه‌ریزی",
    title: "کانبان",
    description: "وضعیت کارها در ستون‌های جریان کار.",
    docsUrl: "https://mermaid.js.org/syntax/kanban.html",
    code: `kanban
    todo[برای انجام]
      task1[طراحی نمودار]
    doing[در حال انجام]
      task2[بازبینی متن]
    done[انجام شده]
      task3[ساخت فایل]`,
  },
  {
    id: "gitgraph",
    category: "برنامه‌ریزی",
    title: "شاخه‌های Git",
    description: "شاخه، ادغام و تاریخچهٔ نسخه‌ها.",
    docsUrl: "https://mermaid.js.org/syntax/gitgraph.html",
    code: `gitGraph
    commit id: "شروع"
    branch feature
    checkout feature
    commit id: "نمودار"
    checkout main
    merge feature id: "انتشار"`,
  },
  {
    id: "pie",
    category: "داده",
    title: "دایره‌ای",
    description: "سهم چند مقدار از کل.",
    docsUrl: "https://mermaid.js.org/syntax/pie.html",
    code: `pie showData
    title زمان مطالعه
    "مطالعه" : 55
    "یادداشت" : 25
    "بازبینی" : 20`,
  },
  {
    id: "xychart",
    category: "داده",
    title: "نمودار XY",
    description: "مقایسهٔ داده‌های عددی روی محور.",
    docsUrl: "https://mermaid.js.org/syntax/xyChart.html",
    code: `xychart-beta
    title "رشد نسخه ها"
    x-axis [1, 2, 3, 4, 5]
    y-axis "تغییرات" 0 --> 20
    line [3, 7, 9, 14, 18]`,
  },
  {
    id: "sankey",
    category: "داده",
    title: "سنکی",
    description: "جریان مقدار میان مبدأ و مقصد.",
    docsUrl: "https://mermaid.js.org/syntax/sankey.html",
    code: `sankey-beta

ورودی،مطالعه،۸
ورودی،ویرایش،۵
ویرایش،انتشار،۴
مطالعه،یادداشت،۳`,
  },
  {
    id: "mindmap",
    category: "ایده",
    title: "نقشهٔ ذهنی",
    description: "شاخه‌بندی موضوع‌ها و ایده‌ها.",
    docsUrl: "https://mermaid.js.org/syntax/mindmap.html",
    code: `mindmap
  root((راوی))
    مطالعه
      پیش نمایش
      فهرست
    نوشتن
      Markdown
      نمودار`,
  },
  {
    id: "journey",
    category: "ایده",
    title: "سفر کاربر",
    description: "مراحل تجربه و میزان رضایت.",
    docsUrl: "https://mermaid.js.org/syntax/userJourney.html",
    code: `journey
    title ساخت یک سند
    section شروع
      باز کردن فایل: 5: کاربر
      ویرایش متن: 4: کاربر
    section پایان
      افزودن نمودار: 5: کاربر
      ذخیره نسخه: 5: کاربر`,
  },
  {
    id: "quadrant",
    category: "داده",
    title: "چهارخانه",
    description: "جای‌گذاری گزینه‌ها روی دو محور.",
    docsUrl: "https://mermaid.js.org/syntax/quadrantChart.html",
    code: `quadrantChart
    title اولویت قابلیت ها
    x-axis کم اثر --> پراثر
    y-axis دشوار --> آسان
    "جستجو": [0.7, 0.8]
    "نمودار": [0.9, 0.6]
    "چاپ": [0.5, 0.7]`,
  },
  {
    id: "swimlane",
    category: "پایه",
    title: "مسیر مسئولیت",
    description: "فرایند در خط‌های جداگانهٔ افراد، تیم‌ها یا سامانه‌ها.",
    docsUrl: "https://mermaid.js.org/syntax/swimlanes.html",
    code: `swimlane-beta RL
    accTitle: رسیدگی به درخواست
    subgraph customer["مشتری"]
        request(["ثبت درخواست"])
    end
    subgraph support["پشتیبانی"]
        review["بررسی درخواست"]
        answer["ارسال پاسخ"]
    end
    request -->|ارجاع| review
    review -->|تأیید| answer`,
  },
  {
    id: "block",
    category: "مهندسی",
    title: "نمودار بلوکی",
    description: "اجزای سامانه با کنترل ستون، پهنا، شکل و اتصال.",
    docsUrl: "https://mermaid.js.org/syntax/block.html",
    code: `block-beta
    columns 3
    editor["ویرایشگر"]
    preview["پیش‌نمایش"]
    storage[("ذخیره‌سازی")]
    editor -->|به‌روزرسانی| preview
    preview -->|ثبت| storage`,
  },
  {
    id: "packet",
    category: "مهندسی",
    title: "ساختار بسته",
    description: "جای فیلدها در یک بستهٔ داده بر اساس تعداد بیت.",
    docsUrl: "https://mermaid.js.org/syntax/packet.html",
    code: `---
config:
  packet:
    bitsPerRow: 32
---
packet
    title بستهٔ داده
    +4: "نسخه"
    +4: "نوع"
    +8: "طول"
    +16: "داده"`,
  },
  {
    id: "radar",
    category: "داده",
    title: "نمودار رادار",
    description: "مقایسهٔ چند سری روی مجموعه‌ای از معیارهای مشترک.",
    docsUrl: "https://mermaid.js.org/syntax/radar.html",
    code: `radar-beta
    title توانمندی تیم
    axis speed["سرعت"], quality["کیفیت"], learning["یادگیری"]
    curve now["اکنون"] { speed: 70, quality: 80, learning: 60 }
    curve goal["هدف"] { speed: 90, quality: 90, learning: 85 }
    showLegend true
    min 0
    max 100
    graticule polygon
    ticks 5`,
  },
  {
    id: "eventmodeling",
    category: "مهندسی",
    title: "مدل‌سازی رویداد",
    description: "جریان زمانی رابط، فرمان، رویداد و مدل‌های سامانه.",
    docsUrl: "https://mermaid.js.org/syntax/eventModeling.html",
    code: `---
title: "جریان ثبت سفارش"
---
eventmodeling
    tf 01 ui SHOP.CART
    tf 02 cmd SHOP.SUBMIT
    tf 03 evt SHOP.CREATED
%% raavi-label:SHOP:%D9%81%D8%B1%D9%88%D8%B4%DA%AF%D8%A7%D9%87
%% raavi-label:CART:%D8%B5%D9%81%D8%AD%D9%87%D9%94%20%D8%B3%D8%A8%D8%AF
%% raavi-label:SUBMIT:%D8%AB%D8%A8%D8%AA%20%D8%B3%D9%81%D8%A7%D8%B1%D8%B4
%% raavi-label:CREATED:%D8%B3%D9%81%D8%A7%D8%B1%D8%B4%20%D8%AB%D8%A8%D8%AA%20%D8%B4%D8%AF`,
  },
  {
    id: "treemap",
    category: "داده",
    title: "نقشهٔ درختی مساحتی",
    description: "نمایش سهم بخش‌ها در یک ساختار سلسله‌مراتبی.",
    docsUrl: "https://mermaid.js.org/syntax/treemap.html",
    code: `---
title: "سهم قابلیت‌ها"
config:
  treemap:
    showValues: true
---
treemap-beta
  "محصول"
    "ویرایشگر": 40
    "مطالعه": 35
    "نمودار": 25`,
  },
  {
    id: "venn",
    category: "داده",
    title: "نمودار ون",
    description: "مجموعه‌ها، هم‌پوشانی‌ها و اندازهٔ هر ناحیه.",
    docsUrl: "https://mermaid.js.org/syntax/venn.html",
    code: `venn-beta
    title هم‌پوشانی مهارت‌ها
    set technical["فنی"]: 12
    set product["محصول"]: 10
    union technical,product["مهارت مشترک"]: 4`,
  },
  {
    id: "ishikawa",
    category: "ایده",
    title: "علت و معلول (ایشیکاوا)",
    description: "دسته‌بندی علت‌های اصلی، علت‌ها و زیرعلت‌های یک مسئله.",
    docsUrl: "https://mermaid.js.org/syntax/ishikawa.html",
    code: `ishikawa
  کندی انتشار
    فرایند
      بازبینی دیرهنگام
        تأیید دستی
    ابزار
      آزمون ناکافی
        پوشش کم`,
  },
  {
    id: "wardley",
    category: "ایده",
    title: "نقشهٔ واردلی",
    description: "زنجیرهٔ ارزش بر اساس دیده‌شدن، بلوغ و وابستگی.",
    docsUrl: "https://mermaid.js.org/syntax/wardley.html",
    code: `wardley-beta
    title زنجیرهٔ ارزش راوی
    size [1100, 700]
    anchor "کاربر" [0.95, 0.65]
    component "راوی" [0.8, 0.55] (build)
    component "ذخیره‌سازی" [0.45, 0.8] (buy)
    "کاربر" -> "راوی"
    "راوی" -> "ذخیره‌سازی"
    evolve "راوی" 0.72`,
  },
  {
    id: "cynefin",
    category: "ایده",
    title: "چارچوب کینِفین",
    description: "جای‌گذاری موقعیت‌ها در دامنه‌های مختلف تصمیم‌گیری.",
    docsUrl: "https://mermaid.js.org/syntax/cynefin.html",
    code: `---
config:
  cynefin:
    showDomainDescriptions: true
---
cynefin-beta
    title تصمیم‌های محصول
    complex
      "کشف قابلیت تازه"
    complicated
      "بهینه‌سازی پایگاه داده"
    clear
      "انتشار نسخه"
    chaotic
      "قطعی سراسری"
    confusion
    complex --> complicated : "الگو شناخته شد"
    chaotic --> complex : "پایداری اولیه"`,
  },
  {
    id: "treeview",
    category: "مهندسی",
    title: "نمای درختی",
    description: "ساختار تو‌در‌توی پوشه‌ها، فایل‌ها یا هر سلسله‌مراتب.",
    docsUrl: "https://mermaid.js.org/syntax/treeView.html",
    code: `---
title: "ساختار پروژه"
config:
  treeView:
    showIcons: true
---
treeView-beta
  "پروژهٔ راوی"/
    "کد منبع"/
      "ویرایشگر.tsx" ## ویرایش متن
    "راهنما.md" ## راهنمای کاربر :::highlight`,
  },
];
