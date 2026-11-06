// ============================================================================
// DEFAULT SEED DATASETS (js/seed-data.js)
// Initial Tasks, Weekly Meals & Family Calendar Events
// ============================================================================

// ============================================================================
var INITIAL_SEED_TASKS = window.INITIAL_SEED_TASKS = [
  // Daily Routine Tasks
  {
    id: "daily-01",
    title: "Empty & Fill Dishwasher",
    day: "Daily",
    taskType: "Daily Task",
    room: "Kitchen",
    estimatedTime: "10 mins",
    isPriority: false,
    actionNote: "Empty clean dishes into cupboards and load sink plates/mugs into dishwasher.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 1
  },
  {
    id: "daily-02",
    title: "Feed Cats & Fresh Water",
    day: "Daily",
    taskType: "Daily Task",
    room: "Kitchen",
    estimatedTime: "5 mins",
    isPriority: false,
    actionNote: "Refill wet & dry cat food bowls and replace water fountain.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 2
  },
  {
    id: "daily-03",
    title: "Scoop & Empty Cat Litter Trays",
    day: "Daily",
    taskType: "Daily Task",
    room: "Utility / Downstairs",
    estimatedTime: "10 mins",
    isPriority: false,
    actionNote: "Scoop litter trays, bag waste, and top up with fresh litter.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 3
  },
  {
    id: "daily-04",
    title: "Make Beds & Tidy Duvets",
    day: "Daily",
    taskType: "Daily Task",
    room: "Bedrooms",
    estimatedTime: "5 mins",
    isPriority: false,
    actionNote: "Straighten sheets, shake pillows, and make bedroom beds.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 4
  },

  // Friday Purge
  {
    id: "fp-01",
    title: "Replace Fire Alarm Battery",
    day: "Friday",
    taskType: "Standard",
    room: "Hallway",
    estimatedTime: "10 mins",
    isPriority: true,
    actionNote: "Priority safety item. Replace 9V battery in hallway smoke detector and test siren.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 5
  },
  {
    id: "fp-02",
    title: "Hardware & Supplies Run",
    day: "Friday",
    taskType: "Standard",
    room: "Shops",
    estimatedTime: "45 mins",
    isPriority: false,
    actionNote: "Pick up 2 pairs yellow rubber gloves, Cif/Jif cream, scrubbers, soda crystals, heavy-duty black sacks, 9V battery.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 6
  },
  {
    id: "fp-03",
    title: "Move Flat-Pack Boxes Up to Bedrooms",
    day: "Friday",
    taskType: "Organization",
    room: "Hallway",
    estimatedTime: "10 mins",
    isPriority: false,
    actionNote: "Shift flat-pack cartons out of hallway corridor and into Ava and Dara bedrooms.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 7
  },
  {
    id: "fp-04",
    title: "Ava Nail Station Pack-Away",
    category: "Friday Purge",
    room: "Living Room",
    estimatedTime: "10 mins",
    isPriority: false,
    actionNote: "Ava packs away UV lamp, polishes, and remover into a dedicated storage box.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 4
  },
  {
    id: "fp-05",
    title: "Clear Coffee Table & Cable Basket",
    category: "Friday Purge",
    room: "Living Room",
    estimatedTime: "15 mins",
    isPriority: false,
    actionNote: "Clear coffee table entirely; tuck white laundry basket of tangled electronics out of sight.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 5
  },
  {
    id: "fp-06",
    title: "Clear Office Desk & Floor Jackets",
    category: "Friday Purge",
    room: "Office",
    estimatedTime: "20 mins",
    isPriority: false,
    actionNote: "Clear mugs, mail, and wrappers. Bag up floor jackets and eBay coats into charity sacks.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 6
  },
  {
    id: "fp-07",
    title: "Downstairs Bedroom Rubbish & Broken Tech",
    category: "Friday Purge",
    room: "Spare Room",
    estimatedTime: "30 mins",
    isPriority: false,
    actionNote: "Bin cardboard/packaging; bag old TV and 2 broken keyboards for tip run.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 7
  },
  {
    id: "fp-08",
    title: "Under-Stairs Coat & Shoe Cull",
    category: "Friday Purge",
    room: "Hallway",
    estimatedTime: "1.5 hrs",
    isPriority: false,
    actionNote: "Strict limit: 1 coat + 2 shoes per person. Move off-season gear to bags.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 8
  },
  {
    id: "fp-09",
    title: "Downstairs WC Odor & Radiator Reset",
    category: "Friday Purge",
    room: "Downstairs WC",
    estimatedTime: "30 mins",
    isPriority: false,
    actionNote: "Move canvas off radiator. Treat basin/toilet drains with soda crystals and boiling water.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 9
  },
  {
    id: "fp-10",
    title: "Friday Tip & Charity Run",
    category: "Friday Purge",
    room: "Car / Civic Tip",
    estimatedTime: "45 mins",
    isPriority: false,
    actionNote: "Load black sacks, dead tech, and donation bags straight into boot and drop at civic amenity.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 10
  },

  // Saturday Reset
  {
    id: "sr-11",
    title: "Front Door Frame & Hinges Toothbrush Scrub",
    category: "Saturday Reset",
    room: "Hallway",
    estimatedTime: "30 mins",
    isPriority: false,
    actionNote: "Use Cif and old toothbrush on flag hinges and frame. Clean glass inside/out.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 11
  },
  {
    id: "sr-12",
    title: "Mow Front & Back Lawns",
    category: "Saturday Reset",
    room: "Garden",
    estimatedTime: "40 mins",
    isPriority: false,
    actionNote: "Mow lawns and edge pathways while weather holds.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 12
  },
  {
    id: "sr-13",
    title: "Car Wash & Interior Vacuum",
    category: "Saturday Reset",
    room: "Driveway",
    estimatedTime: "2 hrs",
    isPriority: false,
    actionNote: "Vacuum interior (boot & footwells), wipe console, exterior wash and dry.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 13
  },
  {
    id: "sr-14",
    title: "Kitchen Cupboards & Drawers Purge",
    category: "Saturday Reset",
    room: "Kitchen",
    estimatedTime: "2 hrs",
    isPriority: false,
    actionNote: "Marie Kondo cull of mismatched glasses, chipped mugs, and redundant kitchen gadgets.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 14
  },
  {
    id: "sr-15",
    title: "Kitchen High Ledge Clear-Out",
    category: "Saturday Reset",
    room: "Kitchen",
    estimatedTime: "1 hr",
    isPriority: false,
    actionNote: "Clear pots, pans, and appliances off shelf above fridge. Attic or store away.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 15
  },
  {
    id: "sr-16",
    title: "Live-Edge Wood Shelves Restyle",
    category: "Saturday Reset",
    room: "Kitchen",
    estimatedTime: "45 mins",
    isPriority: false,
    actionNote: "Strip bare and apply negative space rule: matching canisters and everyday mugs only.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 16
  },
  {
    id: "sr-17",
    title: "Under-Sink Cabinet Reorganize",
    category: "Saturday Reset",
    room: "Kitchen",
    estimatedTime: "30 mins",
    isPriority: false,
    actionNote: "Separate cat supplies from cleaning chemicals into distinct caddies.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 17
  },
  {
    id: "sr-18",
    title: "Office Windowsill Scrub & Blind Dust",
    category: "Saturday Reset",
    room: "Office",
    estimatedTime: "30 mins",
    isPriority: false,
    actionNote: "Deep clean windowsill with Cif/bleach; dust blind slats.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 18
  },
  {
    id: "sr-19",
    title: "Ground Floor Master Vacuum & Mop",
    category: "Saturday Reset",
    room: "All Downstairs",
    estimatedTime: "45 mins",
    isPriority: false,
    actionNote: "Vacuum all rugs/carpets; mop parquet and tiled areas for final weekend reset.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 19
  },

  // DIY Backlog
  {
    id: "diy-20",
    title: "Living Room Coving Installation",
    category: "DIY Backlog",
    room: "Living Room",
    estimatedTime: "1-2 days",
    isPriority: false,
    actionNote: "Measure perimeter, cut mitres, adhere and paint ceiling line.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 20
  },
  {
    id: "diy-21",
    title: "Ava Bedroom Full Renovation",
    category: "DIY Backlog",
    room: "Ava Bedroom",
    estimatedTime: "Multi-day",
    isPriority: false,
    actionNote: "Dismantle built-in wardrobe, patch subfloor/carpet, prep and paint walls, build 2 drawer sets.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 21
  },
  {
    id: "diy-22",
    title: "Attic Floorboarding",
    category: "DIY Backlog",
    room: "Attic",
    estimatedTime: "3-4 hrs",
    isPriority: false,
    actionNote: "Clear pathways and screw down loose tongue-and-groove boards over joists.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 22
  }
];



const DEFAULT_WEEKLY_MEALS = {
  "Monday": { title: "", cook: "", notes: "", tags: "", hasRecipe: false },
  "Tuesday": { title: "", cook: "", notes: "", tags: "", hasRecipe: false },
  "Wednesday": { title: "", cook: "", notes: "", tags: "", hasRecipe: false },
  "Thursday": { title: "", cook: "", notes: "", tags: "", hasRecipe: false },
  "Friday": { title: "", cook: "", notes: "", tags: "", hasRecipe: false },
  "Saturday": { title: "", cook: "", notes: "", tags: "", hasRecipe: false },
  "Sunday": { title: "", cook: "", notes: "", tags: "", hasRecipe: false }
};


const DEFAULT_FAMILY_EVENTS = [
  {
    id: "evt_tutor_ava",
    title: "Maths After School",
    day: "Tuesday",
    time: "15:30",
    duration: "1 hour",
    repeat: "weekly",
    member: "Ava",
    category: "Tutor",
    icon: "📚",
    description: "After school maths tutor.",
    location: "School"
  },
  {
    id: "evt_biology_ava",
    title: "Biology Tutor",
    day: "Tuesday",
    time: "19:00",
    duration: "1 hour",
    repeat: "weekly",
    member: "Ava",
    category: "Tutor",
    icon: "🧬",
    description: "Weekly biology tutor session.",
    location: "Home"
  },
  {
    id: "evt_singing_ava",
    title: "Singing with Fiona",
    day: "Wednesday",
    time: "09:00",
    duration: "1 hour",
    repeat: "weekly",
    member: "Ava",
    category: "Music",
    icon: "🎤",
    description: "Singing lesson with Fiona.",
    location: "Music Room"
  },
  {
    id: "evt_dionne_ava",
    title: "Dionne",
    day: "Wednesday",
    time: "19:00",
    duration: "1 hour",
    repeat: "weekly",
    member: "Ava",
    category: "Activity",
    icon: "☕",
    description: "Dionne activity session.",
    location: "Community Center"
  },
  {
    id: "evt_business_dara",
    title: "Business Tutor",
    day: "Wednesday",
    time: "19:30",
    duration: "1 hour",
    repeat: "weekly",
    member: "Dara",
    category: "Tutor",
    icon: "📚",
    description: "Business studies tutor.",
    location: "Home / Online"
  },
  {
    id: "evt_maths_thu_ava",
    title: "Maths Tutor",
    day: "Thursday",
    time: "16:30",
    duration: "1 hour",
    repeat: "weekly",
    member: "Ava",
    category: "Tutor",
    icon: "📚",
    description: "Weekly maths tutor outside school.",
    location: "Outside school (Sarah's classroom)"
  },
  {
    id: "evt_driving_steve",
    title: "Driving Lesson",
    day: "Thursday",
    time: "17:00",
    duration: "1 hour",
    repeat: "weekly",
    member: "Steven",
    category: "Driving",
    icon: "🚗",
    description: "Instructor pick up at house, local test routes & maneuvers.",
    location: "Local test routes"
  },
  {
    id: "evt_rehearsals_ava",
    title: "Na Leanai Rehearsals",
    day: "Sunday",
    time: "14:00",
    duration: "2 hours",
    repeat: "weekly",
    member: "Ava",
    category: "Music",
    icon: "🎤",
    description: "Band rehearsal and practice.",
    location: "Rehearsal Studio"
  },
  {
    id: "evt_family_sunday",
    title: "Family Get-Together",
    day: "Sunday",
    time: "14:00",
    duration: "3 hours",
    repeat: "weekly",
    member: "Family",
    category: "Family",
    icon: "👨‍👩‍👧‍👦",
    description: "Sunday Roast with Grandparents and cousins.",
    location: "Sunday Roast with Grandparents"
  }
];


window.INITIAL_SEED_TASKS = INITIAL_SEED_TASKS;
window.DEFAULT_WEEKLY_MEALS = DEFAULT_WEEKLY_MEALS;
window.DEFAULT_FAMILY_EVENTS = DEFAULT_FAMILY_EVENTS;
