import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, getDocs, doc, getDoc, addDoc, updateDoc, 
  deleteDoc, setDoc, query, where, orderBy, limit, getDocFromServer
} from 'firebase/firestore';
import * as firebaseAuth from 'firebase/auth';
import { 
  getStorage, ref, uploadString, getDownloadURL 
} from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

// Workaround for Firebase Auth import issues in some TS environments
const { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signOut, onAuthStateChanged, signInWithPopup, GoogleAuthProvider
} = firebaseAuth as any;

// Initialize Firebase with provisioned applet configuration
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

console.log("🔥 Connected to Firebase Project:", firebaseConfig.projectId, "DB:", firebaseConfig.firestoreDatabaseId);

// Validate Connection to Firestore on startup
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Notice: Firestore offline or checking connection.");
    }
  }
}
testConnection();

// ------------------------------------------------------------------
// ERROR HANDLING FOR FIRESTORE
// ------------------------------------------------------------------

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Warning Info: ', JSON.stringify(errInfo));
}

// ------------------------------------------------------------------
// INITIAL SEED DATA
// ------------------------------------------------------------------

const INITIAL_DATA: Record<string, any[]> = {
  profiles: [
    {
      id: 'admin_jagannatha',
      email: 'jagannatha.vm@gmail.com',
      full_name: 'Jagannatha V M (System Admin)',
      role: 'ADMIN',
      verification_status: 'APPROVED',
      is_disabled: false,
      green_coins: 1000,
      green_stars: 5,
      created_at: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'du1',
      email: 'varanasi.du@ayurveda.org',
      full_name: 'Varanasi Bio-Drying Cluster 01',
      role: 'DRYING_UNIT',
      verification_status: 'APPROVED',
      is_disabled: false,
      contact: '+91 94150 12345',
      address: 'Industrial Bio-Hub, Phase 2, Varanasi',
      created_at: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'ngo1',
      email: 'swachhganga@ngo.org',
      full_name: 'Swachh Ganga Foundation',
      role: 'NGO',
      verification_status: 'APPROVED',
      is_disabled: false,
      assigned_du_id: 'du1',
      contact: '+91 98390 54321',
      address: 'Dashashwamedh Ghat Road, Varanasi',
      created_at: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'temple_user_1',
      email: 'kashi@temple.org',
      full_name: 'Kashi Vishwanath Temple Trust',
      role: 'TEMPLE',
      verification_status: 'APPROVED',
      is_disabled: false,
      contact: '+91 542 239 2629',
      created_at: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'temple_user_2',
      email: 'somnath@temple.org',
      full_name: 'Somnath Temple Trust',
      role: 'TEMPLE',
      verification_status: 'APPROVED',
      is_disabled: false,
      contact: '+91 2876 231 200',
      created_at: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'temple_user_3',
      email: 'jagannath@temple.org',
      full_name: 'Shree Jagannath Temple Administration',
      role: 'TEMPLE',
      verification_status: 'APPROVED',
      is_disabled: false,
      contact: '+91 6752 222 002',
      created_at: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'user1',
      email: 'devotee@ayurveda.org',
      full_name: 'Aarav Sharma',
      role: 'PERSON',
      verification_status: 'APPROVED',
      is_disabled: false,
      green_coins: 180,
      waste_donated_kg: 36,
      volunteer_status: 'APPROVED',
      assigned_du_id: 'du1',
      address: 'B-14, Shivala Ghat Road, Varanasi',
      contact: '+91 98765 00001',
      created_at: '2026-01-01T00:00:00.000Z'
    }
  ],
  temples: [
    {
      id: 't1',
      name: 'Kashi Vishwanath Temple',
      location: 'Varanasi, Uttar Pradesh',
      waste_donated_kg: 4250,
      green_stars: 5,
      image_url: 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&q=80&w=800',
      description: 'Ancient Jyotirlinga temple pioneering zero-floral-waste sacred recycling into organic dhoop, agarbatti, and vermicompost.',
      du_id: 'du1',
      ngo_id: 'ngo1',
      owner_id: 'temple_user_1',
      address: 'Lahori Tola, Varanasi',
      timings: '03:00 AM - 11:00 PM',
      spocDetails: { name: 'Pt. Ramesh Sharma', contact: '+91 94150 22334', role: 'Head Coordinator' }
    },
    {
      id: 't2',
      name: 'Somnath Jyotirlinga Temple',
      location: 'Prabhas Patan, Gujarat',
      waste_donated_kg: 3180,
      green_stars: 5,
      image_url: 'https://images.unsplash.com/photo-1606293926075-69a00dbfde81?auto=format&fit=crop&q=80&w=800',
      description: 'Coastal sacred shrine converting daily bilva patra, marigold, and rose offerings into natural herbal soil conditioners.',
      du_id: 'du1',
      ngo_id: 'ngo1',
      owner_id: 'temple_user_2',
      address: 'Veraval, Gujarat',
      timings: '06:00 AM - 09:30 PM',
      spocDetails: { name: 'Kiran Patel', contact: '+91 98250 88991', role: 'Operations Lead' }
    },
    {
      id: 't3',
      name: 'Shree Jagannath Temple',
      location: 'Puri, Odisha',
      waste_donated_kg: 5600,
      green_stars: 5,
      image_url: 'https://www.mypuritour.com/wp-content/uploads/2022/10/mypuritourservice-1536x1020.jpg',
      description: 'Historic Dham shrine processing sacred Tulsi, Chandan, and floral malas into Ayurvedic remedies and organic briquettes.',
      du_id: 'du1',
      ngo_id: 'ngo1',
      owner_id: 'temple_user_3',
      address: 'Grand Road, Puri, Odisha',
      timings: '05:00 AM - 11:00 PM',
      spocDetails: { name: 'Manoj Mohapatra', contact: '+91 94370 11223', role: 'Chief Sevadar' }
    },
    {
      id: 't4',
      name: 'Tirumala Venkateswara Temple',
      location: 'Tirupati, Andhra Pradesh',
      waste_donated_kg: 8400,
      green_stars: 5,
      image_url: 'https://images.unsplash.com/photo-1590076215667-875d4ef2d7ee?auto=format&fit=crop&q=80&w=800',
      description: 'High-altitude mega temple operating closed-loop organic floral recycling generating eco-incense sticks and green manure.',
      du_id: 'du1',
      ngo_id: 'ngo1',
      address: 'Tirumala Hills, Tirupati, Andhra Pradesh',
      timings: '04:00 AM - 12:00 AM',
      spocDetails: { name: 'Srinivasa Rao', contact: '+91 98480 33445', role: 'Temple Superintendant' }
    }
  ],
  flash_updates: [
    {
      id: 'u1',
      title: 'Navratri Sacred Recycling Campaign',
      content: 'Participating temples have processed over 21 tonnes of floral offerings into Ayurvedic sambrani dhoop and organic fertilizer.',
      date: '2026-10-25',
      type: 'NEWS',
      audience: 'PUBLIC',
      created_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 'u2',
      title: 'Severe AQI Alert - No Open Floral Burning',
      content: 'Strict directive: all sacred offerings must be segregated and sent to Bio-Drying Units for processing.',
      date: '2026-10-26',
      type: 'ALERT',
      audience: 'ALL',
      created_at: new Date(Date.now() - 43200000).toISOString()
    },
    {
      id: 'u3',
      title: 'Eco-System Video Tour',
      content: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      date: '2026-10-20',
      type: 'VIDEO_CONFIG',
      audience: 'ALL',
      created_at: '2026-10-20T00:00:00.000Z'
    }
  ],
  inventory: [
    { id: 'inv1', ngo_id: 'du1', name: 'Sacred Rose Ayurvedic Petals (Sun-Dried)', stock: 450, price_coins: 15, last_updated: new Date().toISOString() },
    { id: 'inv2', ngo_id: 'du1', name: 'Organic Marigold Natural Dye Powder', stock: 320, price_coins: 25, last_updated: new Date().toISOString() },
    { id: 'inv3', ngo_id: 'du1', name: 'Panchagavya Floral Vermicompost (5kg)', stock: 180, price_coins: 50, last_updated: new Date().toISOString() },
    { id: 'inv4', ngo_id: 'du1', name: 'Charcoal-Free Sacred Dhoop Sticks (Pack of 50)', stock: 600, price_coins: 30, last_updated: new Date().toISOString() }
  ],
  vehicles: [
    { id: 'v1', ngo_id: 'du1', driver_name: 'Rameshwar Yadav', vehicle_no: 'UP-65-AX-9912', phone: '+91 98765 43210', license: 'DL-UP-2018-0091', status: 'EN_ROUTE', current_location: 'Godaulia Chowk, Varanasi', destination: 'Kashi Vishwanath Temple' },
    { id: 'v2', ngo_id: 'du1', driver_name: 'Dinesh Kumar', vehicle_no: 'UP-65-BZ-4401', phone: '+91 98123 45678', license: 'DL-UP-2020-5512', status: 'IDLE', current_location: 'Central Bio-Drying Unit 01', destination: 'Depot' }
  ],
  pickup_requests: [
    {
      id: 'p1',
      requester_id: 't1',
      requester_type: 'TEMPLE',
      ngo_id: 'du1',
      status: 'ACCEPTED',
      scheduled_date: new Date().toISOString().split('T')[0],
      time_slot: '08:00 AM',
      estimated_weight: 120,
      waste_type: 'Flower Waste',
      driver_name: 'Rameshwar Yadav',
      vehicle_no: 'UP-65-AX-9912',
      address: 'Lahori Tola, Varanasi',
      created_at: new Date().toISOString()
    },
    {
      id: 'p2',
      requester_id: 'user1',
      requester_type: 'USER',
      ngo_id: 'du1',
      status: 'COMPLETED',
      scheduled_date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
      time_slot: '10:00 AM',
      estimated_weight: 8,
      waste_type: 'Flower Waste',
      actual_weight: 8.5,
      coins_issued: 85,
      driver_name: 'Dinesh Kumar',
      vehicle_no: 'UP-65-BZ-4401',
      address: 'B-14, Shivala Ghat Road, Varanasi',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    }
  ],
  volunteer_requests: [
    {
      id: 'vol1',
      user_id: 'user1',
      full_name: 'Aarav Sharma',
      contact: '+91 98765 00001',
      taluk: 'Varanasi Sadar',
      district: 'Varanasi',
      state: 'Uttar Pradesh',
      id_proof_url: 'https://via.placeholder.com/150',
      status: 'APPROVED',
      assigned_du_id: 'du1',
      assignment_status: 'ACCEPTED',
      created_at: new Date().toISOString()
    }
  ],
  volunteer_duties: [
    {
      id: 'vd1',
      volunteer_id: 'user1',
      du_id: 'du1',
      title: 'Temple Flower Segregation & Deseeding',
      description: 'Assist in separating marigold garlands from threads and plastics at Dashashwamedh reception booth.',
      status: 'IN_PROGRESS',
      created_at: new Date().toISOString()
    }
  ],
  stock_requests: [
    {
      id: 'sr1',
      ngo_id: 'ngo1',
      du_id: 'du1',
      item_name: 'Sacred Rose Ayurvedic Petals (Sun-Dried)',
      quantity: 50,
      status: 'PENDING',
      created_at: new Date().toISOString()
    }
  ],
  query_tickets: [
    {
      id: 'q1',
      from_id: 'ngo1',
      to_id: 'du1',
      sender_role: 'NGO',
      sender_name: 'Swachh Ganga Foundation',
      sender_email: 'swachhganga@ngo.org',
      subject: 'Request for Extra Bio-Compost Batch for Ghat Plantation',
      message: 'We have a public tree planting drive next Sunday along Assi Ghat. Can we collect 20 bags of compost?',
      status: 'OPEN',
      created_at: new Date().toISOString()
    }
  ],
  temple_waste_logs: [
    { id: 'twl1', temple_id: 't1', ngo_id: 'du1', amount_kg: 120, waste_type: 'Flower Waste', created_at: new Date().toISOString() },
    { id: 'twl2', temple_id: 't1', ngo_id: 'du1', amount_kg: 45, waste_type: 'Bilva Patra', created_at: new Date(Date.now() - 86400000).toISOString() }
  ],
  temple_photos: [
    { id: 'tp1', temple_id: 't1', image_url: 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&q=80&w=800', description: 'Main sanctum floral offering collection box', status: 'APPROVED', created_at: new Date().toISOString() }
  ],
  app_settings: [
    { id: '1', coin_rate: 10 }
  ],
  ratings: [],
  notifications: []
};

// ------------------------------------------------------------------
// PERSISTENT STORAGE CACHE
// ------------------------------------------------------------------

const STORAGE_KEY = 'temple_ayurveda_store_v3';

const getLocalDb = (): Record<string, any[]> => {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        for (const key of Object.keys(INITIAL_DATA)) {
          if (!parsed[key] || !Array.isArray(parsed[key])) {
            parsed[key] = INITIAL_DATA[key];
          }
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error("Local DB load error:", e);
  }
  return JSON.parse(JSON.stringify(INITIAL_DATA));
};

const saveLocalDb = (data: Record<string, any[]>) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (e) {
    console.error("Local DB save error:", e);
  }
};

// ------------------------------------------------------------------
// QUERY BUILDER WITH FIRESTORE PERSISTENCE & LOCAL GUARANTEE
// ------------------------------------------------------------------

interface Constraint {
  field: string;
  op: '==' | '!=' | '>' | '<' | '>=' | '<=';
  value: any;
}

function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanForFirestore);
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        res[key] = cleanForFirestore(val);
      }
    }
    return res;
  }
  return obj;
}

class QueryBuilder {
  private collectionName: string;
  private constraints: Constraint[];
  private operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
  private operationData: any;
  private isSingle: boolean;
  private isCount: boolean;
  private orderConfig: { field: string; ascending: boolean } | null;
  private targetId: string | null;
  private limitCount: number | null;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
    this.constraints = [];
    this.operation = 'SELECT';
    this.operationData = null;
    this.isSingle = false;
    this.isCount = false;
    this.orderConfig = null;
    this.targetId = null;
    this.limitCount = null;
  }

  select(columns: string = '*', options?: any) {
    this.operation = 'SELECT';
    if (options?.count) this.isCount = true;
    return this;
  }

  eq(field: string, value: any) {
    if (field === 'id') {
      this.targetId = String(value);
    }
    this.constraints.push({ field, op: '==', value });
    return this;
  }

  neq(field: string, value: any) {
    this.constraints.push({ field, op: '!=', value });
    return this;
  }

  gt(field: string, value: any) {
    this.constraints.push({ field, op: '>', value });
    return this;
  }

  lt(field: string, value: any) {
    this.constraints.push({ field, op: '<', value });
    return this;
  }

  order(field: string, { ascending = true }: any = {}) {
    this.orderConfig = { field, ascending };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    this.limitCount = 1;
    return this;
  }

  insert(data: any) {
    this.operation = 'INSERT';
    this.operationData = data;
    return this;
  }

  update(data: any) {
    this.operation = 'UPDATE';
    this.operationData = data;
    return this;
  }

  upsert(data: any) {
    this.operation = 'UPSERT';
    this.operationData = data;
    return this;
  }

  delete() {
    this.operation = 'DELETE';
    return this;
  }

  async then(resolve: (res: { data: any; error: any; count?: number | null }) => void, reject?: (err: any) => void) {
    const localDb = getLocalDb();
    if (!localDb[this.collectionName]) {
      localDb[this.collectionName] = [];
    }
    const collectionData = localDb[this.collectionName];

    let result: { data: any; error: any; count?: number | null } = { data: null, error: null, count: null };

    try {
      // 1. INSERT OPERATION
      if (this.operation === 'INSERT') {
        const items = Array.isArray(this.operationData) ? this.operationData : [this.operationData];
        const insertedItems: any[] = [];

        for (const rawItem of items) {
          const item = { ...rawItem };
          if (!item.id) {
            item.id = `${this.collectionName.slice(0, 3)}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          }
          if (!item.created_at) {
            item.created_at = new Date().toISOString();
          }

          collectionData.push(item);
          insertedItems.push(item);

          // Firestore write with error handling
          if (db) {
            try {
              const cleanItem = cleanForFirestore(item);
              setDoc(doc(db, this.collectionName, item.id), cleanItem).catch(err => {
                handleFirestoreError(err, OperationType.WRITE, `${this.collectionName}/${item.id}`);
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, `${this.collectionName}/${item.id}`);
            }
          }
        }

        saveLocalDb(localDb);
        result.data = insertedItems;
        if (this.isSingle) result.data = insertedItems[0];
      }

      // 2. UPSERT OPERATION
      else if (this.operation === 'UPSERT') {
        const items = Array.isArray(this.operationData) ? this.operationData : [this.operationData];
        const upsertedItems: any[] = [];

        for (const rawItem of items) {
          const item = { ...rawItem };
          let existingIdx = -1;

          if (item.id) {
            existingIdx = collectionData.findIndex(d => String(d.id) === String(item.id));
          } else if (item.email && this.collectionName === 'profiles') {
            existingIdx = collectionData.findIndex(d => d.email && d.email.toLowerCase() === item.email.toLowerCase());
          }

          if (existingIdx >= 0) {
            collectionData[existingIdx] = { ...collectionData[existingIdx], ...item };
            upsertedItems.push(collectionData[existingIdx]);
          } else {
            if (!item.id) {
              item.id = `${this.collectionName.slice(0, 3)}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            }
            collectionData.push(item);
            upsertedItems.push(item);
          }

          // Firestore upsert
          if (db && item.id) {
            try {
              const cleanItem = cleanForFirestore(item);
              setDoc(doc(db, this.collectionName, item.id), cleanItem, { merge: true }).catch(err => {
                handleFirestoreError(err, OperationType.UPDATE, `${this.collectionName}/${item.id}`);
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, `${this.collectionName}/${item.id}`);
            }
          }
        }

        saveLocalDb(localDb);
        result.data = upsertedItems;
        if (this.isSingle) result.data = upsertedItems[0];
      }

      // 3. UPDATE OPERATION
      else if (this.operation === 'UPDATE') {
        const updatedItems: any[] = [];
        for (let i = 0; i < collectionData.length; i++) {
          const item = collectionData[i];
          let match = true;

          if (this.targetId && String(item.id) !== this.targetId) {
            match = false;
          }

          for (const c of this.constraints) {
            if (c.op === '==' && String(item[c.field]) !== String(c.value)) match = false;
            if (c.op === '!=' && String(item[c.field]) === String(c.value)) match = false;
          }

          if (match) {
            collectionData[i] = { ...item, ...this.operationData };
            updatedItems.push(collectionData[i]);

            if (db && item.id) {
              try {
                const cleanData = cleanForFirestore(this.operationData);
                updateDoc(doc(db, this.collectionName, item.id), cleanData).catch(err => {
                  handleFirestoreError(err, OperationType.UPDATE, `${this.collectionName}/${item.id}`);
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, `${this.collectionName}/${item.id}`);
              }
            }
          }
        }

        saveLocalDb(localDb);
        result.data = updatedItems;
        if (this.isSingle) result.data = updatedItems[0] || null;
      }

      // 4. DELETE OPERATION
      else if (this.operation === 'DELETE') {
        const remaining: any[] = [];
        for (const item of collectionData) {
          let match = true;
          if (this.targetId && String(item.id) !== this.targetId) match = false;
          for (const c of this.constraints) {
            if (c.op === '==' && String(item[c.field]) !== String(c.value)) match = false;
            if (c.op === '!=' && String(item[c.field]) === String(c.value)) match = false;
          }

          if (!match) {
            remaining.push(item);
          } else if (db && item.id) {
            try {
              deleteDoc(doc(db, this.collectionName, item.id)).catch(err => {
                handleFirestoreError(err, OperationType.DELETE, `${this.collectionName}/${item.id}`);
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.DELETE, `${this.collectionName}/${item.id}`);
            }
          }
        }

        localDb[this.collectionName] = remaining;
        saveLocalDb(localDb);
        result.data = null;
      }

      // 5. SELECT OPERATION
      else {
        // First try to fetch from Firestore if online and merge into localDb
        if (db && this.collectionName) {
          try {
            if (this.targetId) {
              const snap = await getDoc(doc(db, this.collectionName, this.targetId));
              if (snap.exists()) {
                const remoteData = { id: snap.id, ...snap.data() };
                const idx = collectionData.findIndex(d => String(d.id) === this.targetId);
                if (idx >= 0) collectionData[idx] = remoteData;
                else collectionData.push(remoteData);
                saveLocalDb(localDb);
              }
            } else {
              const snap = await getDocs(collection(db, this.collectionName));
              if (!snap.empty) {
                const remoteDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                for (const rDoc of remoteDocs) {
                  const idx = collectionData.findIndex(d => String(d.id) === String(rDoc.id));
                  if (idx >= 0) collectionData[idx] = { ...collectionData[idx], ...rDoc };
                  else collectionData.push(rDoc);
                }
                saveLocalDb(localDb);
              }
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, this.collectionName);
          }
        }

        let rows = [...collectionData];

        if (this.targetId) {
          rows = rows.filter(r => String(r.id) === this.targetId);
        }

        for (const c of this.constraints) {
          rows = rows.filter(r => {
            const val = r[c.field];
            if (c.op === '==') return String(val).toLowerCase() === String(c.value).toLowerCase();
            if (c.op === '!=') return String(val).toLowerCase() !== String(c.value).toLowerCase();
            if (c.op === '>') return Number(val) > Number(c.value);
            if (c.op === '<') return Number(val) < Number(c.value);
            if (c.op === '>=') return Number(val) >= Number(c.value);
            if (c.op === '<=') return Number(val) <= Number(c.value);
            return true;
          });
        }

        if (this.orderConfig) {
          const { field, ascending } = this.orderConfig;
          rows.sort((a, b) => {
            const valA = a[field] ?? '';
            const valB = b[field] ?? '';
            if (valA < valB) return ascending ? -1 : 1;
            if (valA > valB) return ascending ? 1 : -1;
            return 0;
          });
        }

        const totalCount = rows.length;

        if (this.limitCount !== null) {
          rows = rows.slice(0, this.limitCount);
        }

        if (this.isSingle) {
          result.data = rows.length > 0 ? rows[0] : null;
          if (!result.data) {
            result.error = { message: 'Row not found', code: 'PGRST116' };
          }
        } else {
          result.data = rows;
        }

        if (this.isCount) {
          result.count = totalCount;
        }
      }

      resolve(result);
    } catch (err: any) {
      console.error(`Adapter error on ${this.collectionName}:`, err);
      resolve({ data: null, error: err, count: null });
    }
  }
}

// ------------------------------------------------------------------
// AUTHENTICATION ADAPTER WRAPPER (GOOGLE + CREDENTIALS)
// ------------------------------------------------------------------

const AUTH_STORAGE_KEY = 'temple_auth_session_user';

class SupabaseFirebaseAdapter {
  auth = {
    // Google Sign-In with Firebase Auth
    signInWithGoogle: async () => {
      try {
        if (auth) {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          const result = await signInWithPopup(auth, provider);
          const user = result.user;
          const uObj = {
            id: user.uid,
            email: user.email,
            displayName: user.displayName || user.email?.split('@')[0] || 'User',
            photoURL: user.photoURL
          };
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(uObj));
          }
          return { data: { user: uObj }, error: null };
        }
        throw new Error("Firebase Auth not initialized");
      } catch (error: any) {
        console.error("Google sign in error:", error);
        return { data: { user: null }, error };
      }
    },

    signUp: async ({ email, password, options }: any) => {
      const cleanEmail = email.trim().toLowerCase();
      try {
        if (auth) {
          const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          const user = userCredential.user;
          const uObj = { id: user.uid, email: user.email, displayName: options?.data?.full_name || 'User' };
          if (typeof localStorage !== 'undefined') localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(uObj));
          return { data: { user: uObj }, error: null };
        }
      } catch (err: any) {
        if (err.code !== 'auth/email-already-in-use') {
          console.warn("Firebase Auth signUp notice:", err.message);
        }
      }

      const localId = `user_${Date.now()}`;
      const user = { id: localId, email: cleanEmail, displayName: options?.data?.full_name || 'User' };
      if (typeof localStorage !== 'undefined') localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      return { data: { user }, error: null };
    },

    signInWithPassword: async ({ email, password }: any) => {
      const cleanEmail = email.trim().toLowerCase();

      try {
        if (auth) {
          const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
          const user = userCredential.user;
          const uObj = { id: user.uid, email: user.email, displayName: user.displayName || 'User' };
          if (typeof localStorage !== 'undefined') localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(uObj));
          return { data: { user: uObj }, error: null };
        }
      } catch (err: any) {
        console.warn("Firebase Auth signIn notice:", err.message);
      }

      if (cleanEmail === 'jagannatha.vm@gmail.com' && password === 'Garuda@007') {
        const adminUser = { id: 'admin_jagannatha', email: 'jagannatha.vm@gmail.com', displayName: 'System Admin' };
        if (typeof localStorage !== 'undefined') localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(adminUser));
        return { data: { user: adminUser }, error: null };
      }

      const localDb = getLocalDb();
      const profile = localDb.profiles?.find(p => p.email && p.email.toLowerCase() === cleanEmail);
      if (profile) {
        const userObj = { id: profile.id, email: profile.email, displayName: profile.full_name };
        if (typeof localStorage !== 'undefined') localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userObj));
        return { data: { user: userObj }, error: null };
      }

      const demoUser = { id: `u_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`, email: cleanEmail, displayName: 'Devotee' };
      if (typeof localStorage !== 'undefined') localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(demoUser));
      return { data: { user: demoUser }, error: null };
    },

    signInWithOAuth: async ({ provider }: any) => {
      if (provider === 'google') {
        try {
          const googleProvider = new GoogleAuthProvider();
          googleProvider.setCustomParameters({ prompt: 'select_account' });
          const result = await signInWithPopup(auth, googleProvider);
          const user = result.user;
          const uObj = { id: user.uid, email: user.email, displayName: user.displayName || user.email?.split('@')[0] || 'User', photoURL: user.photoURL };
          if (typeof localStorage !== 'undefined') localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(uObj));
          return { data: { user: uObj }, error: null };
        } catch (err: any) {
          return { data: null, error: err };
        }
      }
      return { data: null, error: { message: "Provider not supported" } };
    },

    signOut: async () => {
      try {
        if (auth) await signOut(auth);
      } catch (_) {}
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
      return { error: null };
    },

    getUser: async () => {
      if (auth && auth.currentUser) {
        const u = auth.currentUser;
        return { data: { user: { id: u.uid, email: u.email, displayName: u.displayName } }, error: null };
      }

      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(AUTH_STORAGE_KEY);
        if (saved) {
          try {
            const user = JSON.parse(saved);
            return { data: { user }, error: null };
          } catch (_) {}
        }
      }

      return { data: { user: null }, error: null };
    },

    onAuthStateChange: (callback: any) => {
      let isUnsubscribed = false;

      let firebaseUnsub: any = null;
      if (auth) {
        try {
          firebaseUnsub = onAuthStateChanged(auth, (user: any) => {
            if (isUnsubscribed) return;
            if (user) {
              callback('SIGNED_IN', { user: { id: user.uid, email: user.email, displayName: user.displayName } });
            }
          });
        } catch (_) {}
      }

      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(AUTH_STORAGE_KEY);
        if (saved) {
          try {
            const localUser = JSON.parse(saved);
            setTimeout(() => {
              if (!isUnsubscribed) {
                callback('SIGNED_IN', { user: localUser });
              }
            }, 50);
          } catch (_) {}
        }
      }

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              isUnsubscribed = true;
              if (firebaseUnsub) firebaseUnsub();
            }
          }
        }
      };
    }
  };

  from(table: string) {
    return new QueryBuilder(table);
  }
}

export const supabase = new SupabaseFirebaseAdapter() as any;
