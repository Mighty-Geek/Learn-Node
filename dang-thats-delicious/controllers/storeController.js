const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');
const User = mongoose.model('User');

const multerOptions = {
    storage: multer.memoryStorage(),
    fileFilter(req, file, next) {
        const isPhoto = file.mimetype.startsWidth('image/');
        if (isPhoto) {
            next(null, true);
        } else {
            next({ message: `That file type isn't allowed!` }, false);
        }
    }
};

exports.homePage = (req, res) => {
    res.render('index');
};
exports.addStore = (req, res) => {
    res.render('editStore', { title: 'Add Store' });
};
exports.upload = multer(multerOptions).single('photo');
exports.resize = async (req, res, next) => {
    // check if there is no new file to resize
    if (!req.file) {
        next();
        return;
    }
    const extension = req.file.mimetype.split('/')[1];
    req.body.photo = `${uuid.v4()}.${extension}`;
    // now we resize
    const photo = await jimp.read(req.file.buffer);
    await photo.resize(800, jimp.AUTO);
    await photo.write(`./public/uploads/${req.body.photo}`);
    // once photo is written in filesystem, keep going!
    next();
};
exports.createStore = async (req, res) => {
    req.body.author = req.user._id;
    const store = await (new Store(req.body)).save();
    await store.save();
    req.flash('success', `Succesfully Created ${store.name}. Care to review?`);
    res.redirect(`/store/${store.slug}`);
};
exports.getStores = async (req, res) => {
    const page = req.params.page || 1;
    const limit = 4;
    const skip = (page * limit) - limit;
    // 1: Query the database for a list of all stores
    const storesPromise = Store
        .find()
        .skip(skip)
        .limit(limit)
        .sort({ created: 'desc' });
    const countPromise = Store.count();
    const [stores, count] = await Promise.all([storesPromise, countPromise]);
    const pages = Math.ceil(count / limit);
    if (!stores.length && skip) {
        req.flash('info', `Hey! You asked for page ${page}. But that doesn't exists. So you are being redirected to page ${pages}`);
        res.redirect(`/stores/page/${pages}`);
        return;
    }
    res.render('stores', { title: 'Stores', stores, pages, page, count });
}
const confirmOwner = (store, user) => {
    if (!store.author.equals(user._id)) {
        throw Error('You must own the store in order to edit details!');
    }
};
exports.editStore = async (req, res) => {
    // 1: Find the store given the ID
    const store = await Store.findOne({ _id: req.params.id });
    // 2: Confirm they are the owner of the store
    confirmOwner(store, req.user);
    // 3: render out the edit form so that user can update their store 
    res.render('editStore', { title: `Edit ${store.name}`, store });
}
exports.updateStore = async (req, res) => {
    // set location data to be a point
    req.body.location.type = 'Point';
    // 1. find and update store
    const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
        new: true, // return new store instead of old one
        runValidators: true,
    }).exec();
    // 2. Redirect user the store and tell it worked
    req.flash('success', `Succesfully updated <strong>${store.name}</strong>. <a href="/stores/${store.slug}">View Store ➡</a>`);
    res.redirect(`/stores/${store._id}/edit`);
}
exports.getStoreBySlug = async (req, res, next) => {
    const store = await Store.findOne({ slug: req.params.slug }).populate('author reviews');
    if (!store) return next();
    res.render('store', { store, title: store.name });
};
exports.getStoresByTag = async (req, res) => {
    const tag = req.params.tag;
    const tagQuery = tag || { $exists: true }
    const tagsPromise = Store.getTagsList();
    const storesPromise = Store.find({ tags: tagQuery });
    const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);

    res.render('tags', { tags, title: 'Tags', tag, stores });
};
exports.searchStores = async (req, res) => {
    const stores = await Store.find({
        $text: {
            $search: req.query.q,
        }
    }, {
        score: { $meta: 'textScore' }
    })
        .sort({
            score: { $meta: 'textScore' }
        })
        .limit(5);
};
exports.mapStores = async (req, res) => {
    const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
    const q = {
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates
                },
                $maxDistance: 10000  // 10 km
            }
        }
    };
    const stores = await Store.find(q).select('slug name description location photo').limit(10);
    res.json(stores);
};
exports.mapPage = (req, res) => {
    res.render('map', { title: 'Map' });
};
exports.heartStore = async (req, res) => {
    const hearts = req.user.hearts.map(obj => obj.toString());
    const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet';
    const user = User
        .findByIdAndUpdate(req.user._id,
            { [operator]: { hearts: req.params.id } },
            { new: true }
        );
};
exports.getHeart = async (req, res) => {
    const stores = await Store.find({
        _id: { $in: req.user.hearts }
    });
    res.render('stores', { title: 'Hearted stores', stores });
};
exports.getTopStores = async (req, res) => {
    const stores = await Store.getTopStores();
    // res.json(stores);
    res.render('topStores', { stores, title: '⭐ Top Stores!' });
}