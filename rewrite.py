import re

with open('src/main.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update DB version and variables
code = code.replace('const DB_NAME = "UzunCarsiDB_v2";', 'const DB_NAME = "UzunCarsiDB_v3";')
code = code.replace('const addDecoBtn = document.getElementById(\'addDecoBtn\');\nconst addCounterBtn = document.getElementById(\'addCounterBtn\');\nconst addRackBtn = document.getElementById(\'addRackBtn\');', 'const addProductBtn = document.getElementById(\'addProductBtn\');')
code = code.replace('const productListEl = document.getElementById(\'productList\');\n', '')
code = code.replace('const addToListBtn = document.getElementById(\'addToListBtn\');\n', '')
code = code.replace('let tempProductList = [];\n', '')
code = code.replace('let activeBoxId = null;', 'let activeEntityId = null;')
code = code.replace('let currentPlacementType = null; // \'deco\', \'counter\', \'rack\'', 'let currentPlacementType = null;')

# 2. Update Editor UI listeners
code = code.replace('''addDecoBtn.addEventListener('click', () => startPlacement('deco'));
addCounterBtn.addEventListener('click', () => startPlacement('counter'));
addRackBtn.addEventListener('click', () => startPlacement('rack'));''', '''addProductBtn.addEventListener('click', () => startPlacement('product'));''')

# 3. Update ghost mesh instantiation
ghost_code = '''    if (type === 'deco') ghostMesh = MeshBuilder.CreateBox('ghost', {width: 0.6, height: 0.8, depth: 0.6}, scene);
    else ghostMesh = MeshBuilder.CreateBox('ghost', {width: 2, height: 1, depth: 1}, scene);'''
new_ghost = '''    ghostMesh = MeshBuilder.CreateBox('ghost', {width: 0.6, height: 0.8, depth: 0.6}, scene);'''
code = code.replace(ghost_code, new_ghost)

# 4. Update createNewEntity
create_entity = '''const createNewEntity = (type, position) => {
    const newEntity = {
        id: "ent_" + Date.now(),
        type: type,
        x: position.x,
        y: position.y,
        z: position.z,
        rotY: 0,
        modelUrl: type === 'deco' ? '/products/valiz.glb' : '',
        products: []
    };
    entities.push(newEntity);
    saveEntityToDB(newEntity);
    instantiateEntity(newEntity);
};'''
new_create = '''const createNewEntity = (type, position) => {
    const newEntity = {
        id: "ent_" + Date.now(),
        type: type,
        x: position.x,
        y: position.y,
        z: position.z,
        rotY: 0,
        brand: "Yeni Marka",
        name: "Yeni Ürün",
        desc: "Açýklama",
        price: "0 TL"
    };
    entities.push(newEntity);
    saveEntityToDB(newEntity);
    instantiateEntity(newEntity);
    openAssignForm(newEntity.id);
};'''
code = code.replace(create_entity, new_create)

# 5. Remove layout logic from editorToggleBtn
code = re.sub(r'// Toggle visibility of box zones.*?\}\);', '', code, flags=re.DOTALL)

with open('src/main.js', 'w', encoding='utf-8') as f:
    f.write(code)
