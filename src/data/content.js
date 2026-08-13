export const appMeta = {
  title: 'NSU B.Tech CSE (AI & ML) Master Hub',
  subtitle: 'A 4-year learning operating system built around the NSU curriculum + industry skills',
  credits: 168,
  targetCgpa: '8.5+',
  note: 'Official NSU subject structure is kept separate from recommended/industry topic mappings because the provided university PDF does not contain complete topic-level detail.'
};

export const semesters = [
  {
    id: 'sem1', number: 1, credits: 20, phase: 'Foundation', color: 'blue',
    subjects: [
      ['BTBSC 101','Engineering Mathematics-I',4,'NSU'],
      ['BTBSC 102','Engineering Physics-I',4,'NSU'],
      ['BTESC 103','Basics of Electrical Engineering',3,'NSU'],
      ['BTESC 104','Engineering Drawing',1,'NSU'],
      ['BTMC 105','Indian Knowledge System',3,'NSU'],
      ['BTBSC 102P','Engineering Physics Lab',1,'NSU'],
      ['BTESC 103P','Basics of Electrical Engineering Lab',1,'NSU'],
      ['BTESC 104P','Engineering Drawing & Computer Graphics Lab',2,'NSU'],
      ['BTESC 107P','Design Thinking & IDEA Lab',1,'NSU']
    ],
    industry: [
      {id:'cpp-basics', title:'C++ Procedural Programming', priority:'MUST', weeks:4, prereq:'Basic computer logic', tags:['C++','Programming'],
       topics:['Variables & data types','Operators','if/else & switch','for/while loops','Functions','Arrays & strings','References','Pointers (intro)','File I/O'],
       resource:{name:'CodeWithHarry — C++ Tutorial for Beginners in Hindi', type:'YouTube', url:'https://www.youtube.com/results?search_query=CodeWithHarry+C%2B%2B+Tutorial+for+Beginners+in+Hindi'},
       practice:{name:'HackerRank C++',url:'https://www.hackerrank.com/domains/cpp'}},
      {id:'git-basics', title:'Git & GitHub Basics', priority:'HIGH', weeks:2, prereq:'None', tags:['Git','GitHub'],
       topics:['git init','add / commit','push / pull / clone','branches','.gitignore','Markdown README'],
       resource:{name:'CodeWithHarry — Git & GitHub in Hindi',type:'YouTube',url:'https://www.youtube.com/results?search_query=CodeWithHarry+Git+GitHub+Hindi'},
       practice:{name:'GitHub Skills',url:'https://skills.github.com/'}},
      {id:'logic-dsa', title:'Problem Solving Foundations', priority:'HIGH', weeks:2, prereq:'Loops & functions', tags:['DSA','Logic'],
       topics:['Pseudocode','Dry runs','Time complexity intuition','Frequency counting','Prime / GCD / reverse-number problems'],
       resource:{name:'takeUforward — basic problem solving / DSA in Hinglish',type:'YouTube',url:'https://www.youtube.com/@takeUforward'},
       practice:{name:'HackerRank Problem Solving',url:'https://www.hackerrank.com/domains/algorithms'}}
    ]
  },
  {
    id: 'sem2', number: 2, credits: 20, phase: 'Programming Core', color: 'cyan',
    subjects: [
      ['BTBSC 201','Engineering Mathematics-II',4,'NSU'],
      ['BTBSC 202','Engineering Chemistry',3,'NSU'],
      ['BTHSMC 203','English for Technical Writing',2,'NSU'],
      ['BTESC 204','Programming for Problem Solving',2,'NSU'],
      ['BTHSMC 205','Universal Human Values',3,'NSU'],
      ['BTBSC 202P','Engineering Chemistry Lab',1,'NSU'],
      ['BTHSMC 203P','English for Technical Writing Lab',1,'NSU'],
      ['BTESC 204P','Programming for Problem Solving Lab',2,'NSU'],
      ['BTESC 206P','Manufacturing Practices Workshop',2,'NSU']
    ],
    industry: [
      {id:'cpp-oop', title:'C++ OOP + STL', priority:'MUST', weeks:4, prereq:'C++ fundamentals', tags:['C++','OOP','STL'],
       topics:['Classes & objects','Constructors / destructors','Encapsulation','Inheritance','Polymorphism','Virtual functions','vector / pair / set / map','Iterators'],
       resource:{name:'Chai aur Code — C++ / OOP Series in Hindi',type:'YouTube',url:'https://www.youtube.com/results?search_query=Chai+aur+Code+C%2B%2B+OOP+Hindi'},
       practice:{name:'GeeksforGeeks OOP',url:'https://www.geeksforgeeks.org/object-oriented-programming-oops-concept-in-java/' }},
      {id:'dsa-arrays', title:'DSA: Arrays → Searching → Sorting → Recursion', priority:'MUST', weeks:8, prereq:'C++ basics', tags:['DSA','Algorithms'],
       topics:['Arrays','Strings','Two pointers','Linear & binary search','Bubble / selection / insertion sort','Merge sort intro','Recursion basics'],
       resource:{name:'Striver A2Z DSA — Hinglish',type:'YouTube',url:'https://www.youtube.com/@takeUforward'},
       practice:{name:'LeetCode',url:'https://leetcode.com/problemset/'}},
      {id:'python-intro', title:'Python Starter Track', priority:'HIGH', weeks:3, prereq:'Basic programming', tags:['Python'],
       topics:['Syntax','lists / tuples / dicts / sets','functions','comprehensions','exceptions','modules','basic OOP'],
       resource:{name:'CampusX — Python for Data Science (Hindi)',type:'YouTube',url:'https://www.youtube.com/@campusx-official'},
       practice:{name:'Kaggle Learn — Python',url:'https://www.kaggle.com/learn/python'}}
    ]
  },
  {
    id:'sem3', number:3, credits:23, phase:'CS + ML Core', color:'purple',
    subjects:[
      ['BTCS A1301','Object Oriented Programming',4,'NSU'],
      ['BTCS A1302','Data Structures',4,'NSU'],
      ['BTCS A1303','Introduction to Machine Learning',4,'NSU'],
      ['BTCS A1304','Artificial Intelligence',4,'NSU'],
      ['BTCS A1305','Modern Computer Architecture',3,'NSU'],
      ['BTESC 306','Mathematical Concepts for AI',4,'NSU']
    ],
    industry:[
      {id:'dsa-core',title:'DSA Core: Linked Lists → Trees → Heaps → Graphs',priority:'MUST',weeks:12,prereq:'OOP + recursion',tags:['DSA'],topics:['Linked lists','Stack / queue / deque','Hashing','Binary trees','BST','Heaps / priority queue','BFS / DFS','Dijkstra','Topological sort'],resource:{name:'Striver A2Z DSA Course',type:'YouTube',url:'https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2/'},practice:{name:'LeetCode',url:'https://leetcode.com/problemset/'}},
      {id:'python-data',title:'Python Data Stack',priority:'MUST',weeks:6,prereq:'Python basics',tags:['Python','Data'],topics:['NumPy arrays','Vectorization','Pandas DataFrame','Cleaning','merge / groupby','Matplotlib','Seaborn','Jupyter / Colab'],resource:{name:'CampusX — Python for Data Science',type:'YouTube',url:'https://www.youtube.com/@campusx-official'},practice:{name:'Kaggle Learn',url:'https://www.kaggle.com/learn'}},
      {id:'classical-ml',title:'Classical Machine Learning',priority:'MUST',weeks:8,prereq:'Python data stack + probability + linear algebra',tags:['ML','scikit-learn'],topics:['Train / validation / test','Data preprocessing','Linear regression','Logistic regression','KNN','Decision trees','Random forest','SVM','K-means','PCA','Metrics / cross-validation'],resource:{name:'CampusX — 100 Days of Machine Learning',type:'YouTube',url:'https://www.youtube.com/@campusx-official'},practice:{name:'Kaggle',url:'https://www.kaggle.com/competitions'}}
    ]
  },
  {
    id:'sem4', number:4, credits:24, phase:'Systems + Deep Learning', color:'pink',
    subjects:[
      ['BTCSAI 401','Theory of Computation',4,'NSU'],
      ['BTCSAI 402','Database Systems',4,'NSU'],
      ['BTCSAI 403','Deep Learning',4,'NSU'],
      ['BTCSAI 404','Operating System',4,'NSU'],
      ['BTCSAI 405','Discrete Mathematical Structures',4,'NSU'],
      ['BTCSAI 406','Web Development Frameworks and Practices',4,'NSU']
    ],
    industry:[
      {id:'sql-db',title:'SQL + Database Engineering',priority:'MUST',weeks:5,prereq:'Basic programming',tags:['SQL','DBMS'],topics:['SELECT / WHERE','JOINs','GROUP BY','subqueries','normalization','indexes','transactions','ACID'],resource:{name:'CodeWithHarry / Apna College SQL Hindi',type:'YouTube',url:'https://www.youtube.com/results?search_query=SQL+Hindi+CodeWithHarry'},practice:{name:'SQLBolt',url:'https://sqlbolt.com/'}},
      {id:'deep-learning',title:'Deep Learning + PyTorch',priority:'MUST',weeks:8,prereq:'Classical ML + calculus basics',tags:['DL','PyTorch'],topics:['Perceptron','MLP','activations','loss','backpropagation','SGD / Adam','regularization','CNN','transfer learning'],resource:{name:'CampusX — Deep Learning / PyTorch',type:'YouTube',url:'https://www.youtube.com/@campusx-official'},practice:{name:'PyTorch Tutorials',url:'https://pytorch.org/tutorials/'}},
      {id:'web-basics',title:'Web Basics for AI Applications',priority:'HIGH',weeks:5,prereq:'Python basics',tags:['Web','APIs'],topics:['HTML','CSS','JavaScript basics','HTTP / JSON','REST APIs','React basics','FastAPI intro'],resource:{name:'Chai aur Code — Web / JS / React in Hindi',type:'YouTube',url:'https://www.youtube.com/@chaiaurcode'},practice:{name:'MDN Web Docs',url:'https://developer.mozilla.org/'}}
    ]
  },
  {
    id:'sem5', number:5, credits:20, phase:'NLP + Advanced ML', color:'orange',
    subjects:[
      ['BTCSAI 501','Natural Language Processing',4,'NSU'],
      ['BTCSAI 502','Advanced Machine Learning',4,'NSU'],
      ['BTCSAI 503','Software Engineering',4,'NSU'],
      ['BTHS 504','Theory of Computation Ecosystems',3,'NSU'],
      ['BTCSAI 505','Open Elective-I: IoT or Robotics',3,'NSU'],
      ['BTEEC 508P','Internship / Summer Industrial Training / Seminar',2,'NSU']
    ],
    industry:[
      {id:'advanced-ml',title:'Advanced ML',priority:'MUST',weeks:7,prereq:'Classical ML',tags:['ML'],topics:['Ensembles','Random forest','XGBoost / LightGBM','SVM','PCA','feature selection','hyperparameter tuning'],resource:{name:'CampusX — Advanced ML topics',type:'YouTube',url:'https://www.youtube.com/@campusx-official'},practice:{name:'Kaggle',url:'https://www.kaggle.com/competitions'}},
      {id:'nlp',title:'NLP Fundamentals → Transformers',priority:'MUST',weeks:10,prereq:'DL + probability basics',tags:['NLP','Transformers'],topics:['Tokenization','TF-IDF','embeddings','RNN / LSTM','attention','self-attention','transformers','BERT / GPT concepts','Hugging Face'],resource:{name:'CampusX — NLP / Transformers',type:'YouTube',url:'https://www.youtube.com/@campusx-official'},practice:{name:'Hugging Face Course',url:'https://huggingface.co/learn'}},
      {id:'api-docker',title:'Production APIs + Docker',priority:'HIGH',weeks:5,prereq:'Python + web basics',tags:['FastAPI','Docker'],topics:['FastAPI','REST','validation','testing','Dockerfile','compose','deployment basics'],resource:{name:'FastAPI official docs',type:'Docs',url:'https://fastapi.tiangolo.com/'},practice:{name:'Docker Get Started',url:'https://docs.docker.com/get-started/'}}
    ]
  },
  {
    id:'sem6', number:6, credits:23, phase:'Optimization + GenAI', color:'green',
    subjects:[
      ['BTCSAI 601','Optimization Techniques in Machine Learning',4,'NSU'],
      ['BTCSAI 602','Data and Visual Analytics in AI',4,'NSU'],
      ['BTCSAI 603','Soft Computing',4,'NSU'],
      ['BTCSAI 604','Computer Networks',4,'NSU'],
      ['BTCSAI 605','Algorithm Analysis and Design',4,'NSU'],
      ['BTCSAI 607P','Minor Project',3,'NSU']
    ],
    industry:[
      {id:'genai',title:'Generative AI Foundations',priority:'MUST',weeks:6,prereq:'Transformers + embeddings',tags:['GenAI'],topics:['LLM basics','embeddings','prompting','structured outputs','evaluation','model APIs'],resource:{name:'Hugging Face Learn + reputable Hinglish explainers',type:'Docs + YouTube',url:'https://huggingface.co/learn'},practice:{name:'Hugging Face Spaces',url:'https://huggingface.co/spaces'}},
      {id:'rag',title:'RAG + Vector Databases',priority:'HIGH',weeks:6,prereq:'Embeddings + APIs',tags:['RAG','Vector DB'],topics:['chunking','retrieval','vector search','reranking','RAG evaluation','Chroma / pgvector','citations'],resource:{name:'Hugging Face / vendor docs',type:'Docs',url:'https://huggingface.co/learn'},practice:{name:'Build a domain RAG app',url:'#'}},
      {id:'networks-system',title:'Networking + System Design Foundations',priority:'HIGH',weeks:6,prereq:'OS basics',tags:['Networks','Systems'],topics:['TCP/IP','DNS','HTTP','sockets','caching','load balancing','databases'],resource:{name:'Neso Academy / Gate Smashers (Hindi)',type:'YouTube',url:'https://www.youtube.com/results?search_query=computer+networks+hindi+Neso+Academy'},practice:{name:'Small API + load-test project',url:'#'}}
    ]
  },
  {
    id:'sem7', number:7, credits:22, phase:'Data + Capstone', color:'indigo',
    subjects:[
      ['BTCSAI 701','Data Warehouse and Data Mining',4,'NSU'],
      ['BTCSAI 702','Professional Elective-I',4,'NSU'],
      ['BTCSAI 703','Professional Elective-II',4,'NSU'],
      ['BTCSAI 704','Open Elective-II',3,'NSU'],
      ['BTEEC 701','Capstone Project (Part-1)',5,'NSU'],
      ['BTEEC 508P','Internship Seminar Evaluation',2,'NSU']
    ],
    industry:[
      {id:'data-engineering',title:'Data Warehousing + Data Mining Practice',priority:'HIGH',weeks:6,prereq:'SQL + analytics',tags:['Data'],topics:['ETL','OLTP vs OLAP','star / snowflake','association rules','data quality'],resource:{name:'GeeksforGeeks / Neso Academy data warehousing',type:'Web + YouTube',url:'https://www.geeksforgeeks.org/data-warehousing-and-data-mining/'},practice:{name:'Build a mini warehouse',url:'#'}},
      {id:'agents',title:'AI Agents + System Design',priority:'HIGH',weeks:6,prereq:'LLMs + RAG + APIs',tags:['Agents','System Design'],topics:['tool calling','workflows','state','evaluation','observability','HLD basics'],resource:{name:'Official LangGraph docs',type:'Docs',url:'https://langchain-ai.github.io/langgraph/'},practice:{name:'Build an agent workflow',url:'#'}}
    ]
  },
  {
    id:'sem8', number:8, credits:16, phase:'Capstone + Job Ready', color:'slate',
    subjects:[
      ['BTCSAI 801','Professional Elective-III',4,'NSU'],
      ['BTCSAI 802','Professional Elective-IV',4,'NSU'],
      ['BTEEC 803P','Capstone Project (Part-II)',8,'NSU']
    ],
    industry:[
      {id:'mlops',title:'MLOps + Production Engineering',priority:'HIGH',weeks:8,prereq:'Docker + APIs + ML',tags:['MLOps','Cloud'],topics:['CI/CD','experiment tracking','model registry concepts','monitoring','deployment','cloud basics'],resource:{name:'Made With ML',type:'Web',url:'https://madewithml.com/'},practice:{name:'Deploy and monitor your capstone',url:'#'}},
      {id:'job-ready',title:'Interview + Portfolio Mastery',priority:'MUST',weeks:6,prereq:'Completed projects',tags:['Career'],topics:['DSA revision','CS fundamentals','ML interview','project storytelling','resume','mock interviews'],resource:{name:'takeUforward / NeetCode / company-specific prep',type:'Web + YouTube',url:'https://neetcode.io/'},practice:{name:'Mock interviews + timed sets',url:'#'}}
    ]
  }
];

export const resourceLibrary = [
  {name:'CodeWithHarry',focus:'C++ / Git / SQL / Web basics',lang:'Hindi',url:'https://www.youtube.com/@CodeWithHarry'},
  {name:'Chai aur Code',focus:'C++ / OOP / Web / React',lang:'Hindi/Hinglish',url:'https://www.youtube.com/@chaiaurcode'},
  {name:'takeUforward (Striver)',focus:'DSA',lang:'Hinglish',url:'https://takeuforward.org/'},
  {name:'CampusX',focus:'Python / Data Science / ML / DL / NLP',lang:'Hindi/Hinglish',url:'https://www.youtube.com/@campusx-official'},
  {name:'Kaggle Learn',focus:'Python / Pandas / Intro ML',lang:'English (short)',url:'https://www.kaggle.com/learn'},
  {name:'Hugging Face Learn',focus:'Transformers / LLMs',lang:'English',url:'https://huggingface.co/learn'},
  {name:'MDN',focus:'Web platform',lang:'English',url:'https://developer.mozilla.org/'},
  {name:'PyTorch Tutorials',focus:'Deep Learning',lang:'English',url:'https://pytorch.org/tutorials/'},
  {name:'SQLBolt',focus:'SQL practice',lang:'English',url:'https://sqlbolt.com/'},
  {name:'LeetCode',focus:'DSA practice',lang:'English',url:'https://leetcode.com/problemset/'},
  {name:'GitHub Skills',focus:'Git/GitHub',lang:'English',url:'https://skills.github.com/'}
];

export const weeklyTemplate = [
  {day:'Mon', focus:'University + Programming', minutes:120},
  {day:'Tue', focus:'University + DSA', minutes:120},
  {day:'Wed', focus:'University + Programming', minutes:120},
  {day:'Thu', focus:'University + DSA', minutes:120},
  {day:'Fri', focus:'University + Math / revision', minutes:120},
  {day:'Sat', focus:'Project + long study block', minutes:240},
  {day:'Sun', focus:'Revision + planning + rest', minutes:120}
];
