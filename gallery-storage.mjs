// A gallery list never retains image blobs, backgrounds or editable card bodies.
export function cardHeaders(database, storeName) {
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readonly'), rows = [];
        const request = transaction.objectStore(storeName).openCursor();
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) return;
            const {id, charName, createdAt} = cursor.value;
            rows.push({id, charName, createdAt});cursor.continue();
        };
        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || Error('Gallery read aborted'));
        transaction.oncomplete = () => resolve(rows.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)));
    });
}

export async function equalStoredValue(a, b) {
    if (a === b) return true;
    if (a instanceof Blob || b instanceof Blob) {
        if (!(a instanceof Blob && b instanceof Blob) || a.size !== b.size || a.type !== b.type) return false;
        const left = new Uint8Array(await a.arrayBuffer()), right = new Uint8Array(await b.arrayBuffer());
        return left.every((v,i)=>v===right[i]);
    }
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    for (const key of keys) if (!Object.hasOwn(b,key) || !await equalStoredValue(a[key],b[key])) return false;
    return true;
}

export function lazyCardImages(read, overlay) {
    const items = new Map();let running = false, disposed = false;
    const release = item => { if(item.url)URL.revokeObjectURL(item.url);item.url=null;item.img.removeAttribute('src'); };
    async function drain() {
        if (running || disposed) return;
        running=true;
        try {
            let item;
            while (!disposed && (item=[...items.values()].find(x=>x.visible&&!x.loaded&&!x.loading))) {
                item.loading=true;
                try {
                    const record=await read(item.id);
                    if(disposed || !item.visible || !items.has(item.img))continue;
                    if(record?.imageBlob){item.url=URL.createObjectURL(record.imageBlob);item.img.src=item.url;}
                    else if(record?.dataUrl)item.img.src=record.dataUrl;
                    item.loaded=true;
                } catch { item.loaded=true;item.img.alt='사진을 불러오지 못했어요. 다시 열어 주세요.'; }
                finally { item.loading=false; }
            }
        } finally {running=false;}
    }
    const observer=new IntersectionObserver(entries=>{
        for(const entry of entries){const item=items.get(entry.target);if(!item)continue;
            item.visible=entry.isIntersecting;
            if(!item.visible){release(item);item.loaded=false;}
        }
        void drain();
    },{rootMargin:'200px'});
    const clear=()=>{observer.disconnect();for(const item of items.values())release(item);items.clear();};
    const removed=new MutationObserver(()=>{if(!overlay.isConnected){disposed=true;clear();removed.disconnect();}});
    removed.observe(document.body,{childList:true});
    return {
        clear,
        add(img,id){const item={img,id,visible:false,loaded:false,loading:false,url:null};items.set(img,item);observer.observe(img);},
        remove(img){const item=items.get(img);if(item)release(item);items.delete(img);observer.unobserve(img);},
    };
}
