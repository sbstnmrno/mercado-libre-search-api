const Express = require('express');
const fetch = require('node-fetch');
const PORT = 9090;
const app = Express();
const BASE_URL = 'https://api.mercadolibre.com/';
const SEARCH_PATH = 'sites/MCO/search';
const ITEM_PATH = 'items/';
const CATEGORIES_PATH = 'categories/';
const CATEGORY_CODE = 'category';

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Main Structure

const assembleResponse = async (body, isDetail = false) => {
    const obj = {
        author: {
            name: 'Sebastián',
            lastname: 'Moreno'
        },
        categories: []
    }
    await addGeneralProperties(body, obj, isDetail);
    return obj;
}

const assembleItem = async (item, isDetail) => {
    const obj = {
        id: item.id,
        title: item.title,
        price: {
            currency: item.currency_id,
            amount: item.price,
            decimals: 0
        },
        location: item.seller_address.state.name,
        picture: item.thumbnail,
        condition: item.condition,
        free_shipping: item.shipping.free_shipping
    };
    isDetail && await addDetailProperties(item, obj);
    return obj;
}

const addGeneralProperties = async (body, obj, isDetail) => {
    if(!isDetail) {
        obj.items = [];
        await Promise.all(body.results.map(async item => {
            const itemAssembled = await assembleItem(item, isDetail);
            obj.items.push(itemAssembled);
        }));
        obj.categories = body.filters?.length > 0 ? addMainCategories(body.filters) : await addSecondaryCategories(body.available_filters);
    }
    if(isDetail) {
        obj.item = await assembleItem(body, isDetail);
        obj.categories = await getPathFromRoot(body.category_id);
    }
}

const addMainCategories = (filters) => {
    let category = filters.find(el => el.id === CATEGORY_CODE);
    const pathList = [];
    if(category){
        category.values[0]?.path_from_root.map(val => pathList.push(val.name))
        return pathList
    }
}

const addSecondaryCategories = async (filters) => {
    const category = filters.find(el => el.id === CATEGORY_CODE);
    const highest = category.values.sort((a, b) => b.results - a.results)[0];
    const list = await getPathFromRoot(highest.id);
    return list;
}


const addDetailProperties = async (item, obj) => {
    obj.sold_quantity = item.sold_quantity;
    const description = await getItemDescription(item.id);
    obj.description = description;
}

// Get secondary info

const getPathFromRoot = async (id) => {
    const call = await fetch(`${BASE_URL + CATEGORIES_PATH + id}`);
    const object = await call.json();
    const pathList = [];
    object.path_from_root.map(path => pathList.push(path.name));
    return pathList;
}

const getItemDescription = async (id) => {
    const call = await fetch(`${BASE_URL + ITEM_PATH + id}/description`);
    const object = await call.json();
    return object.plain_text;
}

// Endpoints

app.get('/api/items', (req, res) => {
    const { q, limit } = req.query;
    fetch(`${BASE_URL + SEARCH_PATH}?q=${q}&limit=${limit}`)
    .then(res => res.json())
    .then(body => {
        assembleResponse(body)
        .then(obj => {
            res.status(200).send(obj);
        }).catch(err => console.log(err));
    })
    .catch(err => res.status(500).send(`error: ${err}`));
});

app.get('/api/items/:id',(req, res) => {
    const { id } = req.params;
    fetch(`${BASE_URL + ITEM_PATH + id}`)
    .then(res => res.json())
    .then(body => {
        assembleResponse(body, true)
        .then(obj => {
            res.status(200).send(obj);
        }).catch(err => console.log(err));
    })
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));