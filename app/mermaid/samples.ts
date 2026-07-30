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

Input,Reading,8
Input,Editing,5
Editing,Publish,4
Reading,Notes,3`,
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
];
