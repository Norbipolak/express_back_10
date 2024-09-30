import express from "express";
import expressEjsLayouts from "express-ejs-layouts";
import UserHandler from "./app/userHandler,js"; 
import session from "express-session"
import successHTTP from "./app/successHTTP.js";
import Addresses from "./app/Addresses.js";
import getMessageAndSuccess from "./app/getMessageAndSuccess.js";
import checkPermission from "./app/checkPermission.js";
import checkAdminPermission from "./app/checkAdminPermission.js";
import ProductCategories from "./app/ProductCategories.js";

const app = express();

app.set("view engine", "ejs");
app.use(expressEjsLayouts);
app.use(urlencoded({extended: true}));
app.use(express.static("assets"));

app.use(session());

app.use(session({
    secret: "asdf",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24*60*60*1000
    }
}));

const uh = new UserHandler();
const p = new Profile(); 
const a = new Addresses();
const pc = new ProductCategories();

app.get("/", (req, res)=> {
    res.render("public/index", 
        {
            layout: "layouts/public_layout", 
            title: "Kezdőlap", 
            baseUrl: process.env.BASE_URL,
            page:"index",
            message:req.query.message ? req.query.message : ""
        }
    );
});

app.post("/regisztracio", async (req, res)=> {
    let response;
    try {
        response = await uh.register(req.body); 
    } catch (err) {
        response = err;
    }

    //response.success = response.status.toString(0) === "2";
    response.success = successHTTP(response.status);
    res.status(response.status);

    res.render("public/register_post", {
        layout: "./layout/public_layout",
        message: response.message,
        title: "Regisztráció",
        baseUrl: process.env.BASE_URL,
        page: "regisztracio", 
        success: response.success
    })
});

app.post("/login", async (req, res)=> {
    let response;
    let path;

    try{
        response = uh.login(req.body);
        req.session.userName = response.message.userName;
        req.session.userID = response.message.userID;
        req.session.isAdmin = response.message.isAdmin;

        path = response.message.isAdmin == 0 ? "/user/profil" : "/admin/profil"
    } catch(err) {
        response = err;
    }

    response.success = successHTTP(response.status);


    res.status(response.status).redirect(
        response.success ? path : `/bejelentkezes?message=${response.message[0]}`
    )

})

app.get("/bejelentkezes", (req, res)=> {
    res.render("public/login", {
        layout: "./layouts/public_layout",
        title: "Bejelentkezés",
        baseUrl: process.env.BASE_URL,
        page: "bejelentkezes",
        message: req.query.message ? req.query.message : ""
    })
});

app.get("/user/profil", async (req, res)=> {
    try {
        checkPermission(req.session.userID);
        const profileData = await p.getProfile(req.session.userID);
        //const messages = req.query.messages.split(",");
        /*
            Mert a getProfile függvény vár egy id-t és az alapján lehozza az összes (*) adatot, ahhoz az id-ű rekordhoz 
        */
        //csináltunk egy segédfüggvényt
        const messageAndSuccess = getMessageAndSuccess(req.query);
        
        res.render("user/profile", {
            layout: "./layouts/user_layout",
            title: "Profil Szerkesztése",
            baseUrl: process.env.BASE_URL,
            profileData: profileData.message, //itt meg megszerezzük az összes mezőt az adatbázisból 
            page: "profil", 
            message: messageAndSuccess.message,
            success: messageAndSuccess.success
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.post("/user/profil", async (req, res)=> {
    let response;

    try {
        const user = req.body;
        user.userID = req.session.userID;
        response = await p.updateProfile(user);
    } catch(err) {
        response = err;
    }

    console.log(response);

        
    const success = successHTTP(response.status);
    res.redirect(`/user/profil?success=${success}&messages=${response.message}`);
});

app.get("/user/cim-letrehozasa", async (req, res)=> {
    try {
        checkPermission(req.session.userID);
        const addressTypes = await a.getAddressTypes();
        const messageAndSuccess = getMessageAndSuccess(req.query);
    
        res.render("user/create_address", {
            layout: "./layouts/user_layout", 
            title: "Címek létrehozása", 
            page: "címek",
            addressTypes: addressTypes,
            baseUrl: process.env.BASE_URL,
            message: messageAndSuccess.message,
            success: messageAndSuccess.success,
            address:{}
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    } 
   
});

app.post("/user/create_address", async (req, res)=> {
    //itt szedjük majd le az adatokat 
    let response;

    try {
        response = await a.createAddress(req.body, req.session.userID);
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.status);

    if(success) {
        res.status(response.status).redirect(`/user/cim-letrehozasa/${response.insertID}?message=${response.message}&success=${success}`);
    } else {
        res.status(response.status).redirect(`/user/cim-letrehozasa?message=${response.message}&success=${success}`);
    }
    
});

app.get("/user/cim-letrehozasa:addressID", async (req, res)=> {
    try {
        checkPermission(req.session.userID);
        const addressTypes = await a.getAddressTypes();
        const messageAndSuccess = getMessageAndSuccess(req.query);
        const address = await a.getAddressByID(req.params.addressID, req.session.userID);
        console.log(address);
    
        res.render("user/create_address", {
            layout: "./layouts/user_layout", 
            title: "Címek létrehozása", 
            baseUrl: process.env.BASE_URL,
            page: "címek",
            addressTypes: addressTypes,
            message: messageAndSuccess.message,
            success: messageAndSuccess.success,
            address:address
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    } 
});

app.post()

app.get("/user/címek", async (req, res)=> {
    let response;

    try {
        checkPermission(req.session.userID),
        response = await a.getAddressesByUser(req.session.userID);
    } catch(err) {
        if(err.status === 403) {
            res.redirect(`/message=${err.message}`);
        }
        response = err;
    }

    res.render("user/addresses", { 
        layout: ".layout/user_layout",
        addresses: response.message,
        baseUrl: process.env.BASE_URL,
        title: "Címek", 
        page: "címek"
    })
});

app.post("user/create-address/:addressID", async (req, res)=> {
    let response;

    try {
        const address = req.body;
        address.addressID = req.params.addressID;
        response = await a.updateAddress(address, req.session.userID);
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.success);
    res.redirect(`/user/cim-letrehozasa/${req.params.addressID}?message=${response.message}&success=${success}`);
    /*
        fontos, hogy azokat ami egy url változó query, azt ?xx=xx formátumba kell csinálni   
    */
})

app.get("/admin/profil", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );
        const profileData = await p.getProfile(req.session.userID);
        const messageAndSuccess = getMessageAndSuccess(req.query);
        
        res.render("admin/profile", {
            layout: "./layouts/admin_layout",
            title: "Profil Szerkesztése",
            baseUrl: process.env.BASE_URL,
            profileData: profileData.message, //itt meg megszerezzük az összes mezőt az adatbázisból 
            page: "profil", 
            message: messageAndSuccess.message,
            success: messageAndSuccess.success
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.get("/admin/felhasznalok", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );

        const users = await uh.search(
            req.session.userID,
            req.session.isAdmin
        )
        
        res.render("admin/users", {
            layout: "./layouts/admin_layout",
            title: "Felhasználok",
            baseUrl: process.env.BASE_URL,
            profileData: users.message,
            page: "felhasznalok", 
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.get("/admin/termek-kategoriak", async (req, res)=> {
    try {
        // checkAdminPermission(
        //     req.session.userID,
        //     req.session.isAdmin
        // );

        const categories = await pc.getProductCategories(
            // req.session.userID,
            // req.session.isAdmin
        )
        
        res.render("admin/product-categories", {
            layout: "./layouts/admin_layout",
            title: "Termék kategóriák",
            baseUrl: process.env.BASE_URL,
            categories: categories,
            page: "termek-kategoriak", 
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.get("/admin/termek-kategoria", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );
        
        res.render("admin/product-category", {
            layout: "./layouts/admin_layout",
            title: "Termék kategória",
            baseUrl: process.env.BASE_URL,
            page: "termek-kategoria", 
            categoryData: null
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.post("admin/create-category", async (req, res)=> {
    let response;

    try {
        response = await pc.createCategory(
            req.body,
            req.session.userID,
            req.session.isAdmin
        )
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.success);
    if(success) {
        res.redirect(`/admin/termek-kategoria/${response.insertID}?message=${response.message}&success=${success}`);
    } else {
        res.redirect(`/admin/termek-kategoria/?message=${response.message}&success=${success}`);
    }
});

app.get("/admin/termek-kategoria/:categoryID", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );

        const categoryData = await pc.getCategoryByID(req.params.categoryID);
        /*
            fontos, hogy itt ha response [0][0], akkor azt az egyet kapjuk meg, ami nekünk kell 
            async getCategoryByID(categoryID) {
                 try {
                    const response = await conn.promise().query(
                    "SELECT * FROM product_categories WHERE categoryID = ?"
                    [categoryID]
                    );
                return response[0][0];                        *****
        */
        
        res.render("admin/product-category", {
            layout: "./layouts/admin_layout",
            title: "Termék kategória",
            baseUrl: process.env.BASE_URL,
            page: "termek-kategoria", 
            categoryData:categoryData
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});




app.listen(3000, console.log("the app is listening on localhost:3000"));

/*
    Most a címeket felvittük, de az admin-nak kellenne  most felvinni a termék-kategoriákat meg a termékeket 
    Ezért csinálunk (beszúrással) sql-en egy admin felhasználót 

    Megnézzük, hogy a bejelentkezésnél (post login), hogy jártunk el, merthogy ez a path-os dolog, hogy 
    path = response.message.isAdmin == 0 ? "/user/profil" : "/admin/profil";

    res.status(response.status).redirect(
        response.success ? path : `/bejelentkezes?message=${response.message[0]}`;
    )
    
    De még nincsen olyan, hogy admin/profil,ezért csinálunk egy olyat (get-es kérés)
    Itt meg kell nézni, hogy adminok vagyunk vagy sem 

    Biztos, hogy itt nem a user/profile-t fogjuk majd render-elni, hanem a admin/profile-t 
    de még olyanunk sincsen, ezért megcsináljuk, views-ban csinálunk egy admin mappát és oda a profile.ejs-t 
    lemásoljuk a user mappában lévő profile.ejs-ből a dolgokat 

    Most bejelentkeztünk az admin felhasználóval, amit csináltunk és ide vitt minket -> localhost:3000/admin/profil
    
    A render-nél nem a user_layout hanem az admin_layout-ot kell megadni, de még olyan sincs, ezért megcsináljuk 
    mert, hogy itt mások a menüpontok 

    Meg kell egy olyan, hogy checkAdminPermission, hogy meg tudjuk nézni, nem csak azt, hogy van-e ilyen userID, hanem az is, hogy admin-e 
    ->
    function checkPermission(userID, isAdmin) {
    if(nullOrUndefined(userID) || nullOrUndefined(isAdmin) || isAdmin == 0) {
        throw {
            status: 403,
            message: "Jelentkezz be a tartalom megtekintéséhez!"
        }
    }

    Itt a userID mellett bekértünk egy isAdmin-t is és ha az nem létezik vagy 0 (1 az isAdmin, akkor vagyunk admin-ok)
    Tehát ha ez van, akkor nincsen jogosultságunk és dobunk egy 403-as hibát 
    És a get-es kérésnél meg nem úgy mint a user/profile-nál, ahol a checkPermission-t hívtuk meg, itt a checkAdminPermission-t kell meghívni 
    De mivel a session-ben csak a userName-t meg a userID-t tároltuk el, ezért ott fontos, hogy az isAdmin is el legyen!!!! 
    -> 
    app.post("/login", async (req, res)=> {
    let response;
    let path;

    try{
        response = uh.login(req.body);
        req.session.userName = response.message.userName;
        req.session.userID = response.message.userID;
        req.session.isAdmin = response.message.isAdmin;              *********
        
    és fontos, hogy a login-nál (userHandler) is vissza legyen adva a isAdmin
    -> 
        async login(user) {
        try {
            const response = await conn.promise().query(
                `SELECT userID, userName, isAdmin FROM users WHERE email = ? AND pass = ?`,

    Tehét fontos, hogy az isAdmin is belekerükjön a session-be és a checkAdminPermission-nál pedig azt is át kell adni a session-ből 
    -> 
    app.get("/admin/profil", async (req, res)=> {
    try {
        checkAdminPermission(      **********
            req.session.userID,
            req.session.isAdmin
        );

    Csinálunk egy admin_layout.ejs-t, mert más menüpontok lesznek (de amugy teljesen ugyanaz, mint a user_layout)
    -> 
            <li>
                <a href="/">Home</a>
            </li>
            <li class="<%=page === 'profil' ? 'selected-menu' : '' %>">
                <a href="/admin/profil">Profil</a>   **fontos, hogy ez /admin/profil, nem /user/profil meg az összes többi is /admin/ 
            </li>
            <li class="<%=page === 'felhasznalok' ? 'selected-menu' : '' %>">
                <a href="/admin/felhasznalok">Felhasználók</a>
            </li>
            <li class="<%=page === 'termek-kategoriak' ? 'selected-menu' : '' %>">
                <a href="/admin/termek-kategoriak">Termék kategóriák</a>
            </li>
            <li class="<%=page === 'termekek' ? 'selected-menu' : '' %>">
                <a href="/admin/termekek">Termékek</a>

    Itt a render-elésnél pedig az admin/layout-ot fogjuk megadni layout-nak
    -> 
        res.render("admin/profile", {
        layout: "./layouts/admin_layout",
    És ha most bejelentkezünk, akkor ezek lesznek a menüpontok, hogy home-profil-felhasználók-termék kategoriák-termékek-kijelentkezés

    Következő, hogy meg kell jeleníteni a felhasználókat a felhasználók menüpontban 
    userHandler-ben csinálunk egy user async függvényt, ott bekérünk egy userID meg egy isAdmin, hogy leellenőrizzük őket, hogy megvannak-e
    -> 
    async search(userID, isAdmin) {
        checkAdminPermission(userID, isAdmin);

        try {
            const response = await conn.promise().query("SELECT * FROM users");
            return response[0]
        } catch(err) {

    És ha ez meg van, akkor itt az index-en el kell készíteni a get-es kérést a felhasználókra 
    ->
    app.get("/admin/felhasznalok", async (req, res)=> {
    message-es meg a success-es dolog itt nem kell a render-nél 
        message: messageAndSuccess.message,
        success: messageAndSuccess.success
    de viszont ami kell, hogy az admin/users-t render-eljük 
    ->
    res.render("admin/users", { és ezt majd meg is kell csinálni 
    ->
    app.get("/admin/felhasznalok", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );

        const users = await uh.search(
            req.session.userID,
            req.session.isAdmin
        )
        
        res.render("admin/users", {
            layout: "./layouts/admin_layout",
            title: "Felhasználok",
            baseUrl: process.env.BASE_URL,
            users: users,   *** fontos, hogy itt nincsen message, mert a search()-ben most nem egy objektumot return-öltünk hanem -> return response[0]
            page: "felhasznalok", 
        })

    Admin mappába csinálunk egy ejs oldalt, amit itt render-elünk 
    és akkor itt egy grid-ben megjelenítjük egy forEach ciklussal a felhasználókat (users)
    ->
    <div class="container">
        <div class="grid">
            <% users.forEach(u=> {  %>
                <div class="box">
                    <h4>Név</h4>
                    <%= u.firstName + "" + u.lastName%>

                    <h4>Felhasználónév</h4>
                    <%= u.userName%>

                    <h4>Email</h4>
                    <%= u.email%>
                </div>
            <% }) %>
        </div>
    </div>

    És így meg vannak jelenítve a profilok, amit fel vannak véve az adatbázisban 

    Most kellenek a termek-kategoriak 
    Csinálunk egy ilyen osztályt, hogy ProductCategories.js 
    Itt is szükségünk van a conn-ra, ezért beimportáljuk -> import conn from "./conn.js";
    product_categories az egy egyszerű tábla, ahol csak ezek vannak 
    categoryID categoryName categoryDesc 

    Megcsináltuk a checkData-t itt is ami vár egy product-ot, hogy leellenőrizze, hogy ki van-e töltve az a mező 

    Most meg csinálunk egy addCategory függvényt a termékek felvitelére 
    -> 
    async addCategory(category, userID, isAdmin)
        ....
            try {
            const response = await conn.promise().query(`
                INSERT INTO product_categories (categoryName, categoryDesc)
                VALUES`, 
                [category.categoryName, category.categoryDesc]
            );

            if(response[0].affectedRows === 1) {
                return {
                    status: 200,
                    message: ["Sikeres feltöltés!"],
                    insertID: response[0].insertID

    Most kell csinálni erre egy get-es endpoint-ot!!! 
    Ha felmegyünk a termek-kategoriak-ra, akkor ott kell lennie az összes kategóriának a megnyítás gombbal 
    felül pedig a kategória létrehozása gomb, hasonlóan, mint ahogy a címeknél csináltuk 
    Ehhez kell egy olyan, hogy leszedjük az összes kategóriát -> ProductCategories async getProductCategories
    meg fontos, hogy be legyen hívva a class, hogy ezeket a függvényeket, amik bennük vannak ezeket majd tudjuk használni (meghívni)!!! 
    const pc = new ProductCategories();

    app.get("/admin/termek-kategoriak", async (req, res)=> {
    try {               ****
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );

        const categories = await pc.getProductCategories(
            req.session.userID,
            req.session.isAdmin
        )
                    ********************
        res.render("admin/product-categories", {
            layout: "./layouts/admin_layout",
            title: "Termék kategóriák",
            baseUrl: process.env.BASE_URL,
            categories: categories,       ******
            page: "termek-kategoriak", 
        })

És még nincsen ilyen ejs fájlunk, amit itt render-elni akarunk -> megcsináljuk a product-categories.ejs-t 
<div class="container"></div>
<a href="<%= BASE_URL%>/admin/termek-kategoria">
    <button>Létrehozás</button>
</a>

    <div class="grid">
        <% categories.forEach(c=> {  %>
            <div class="box">
                <h4>Név</h4>
                <%= c.categoryName%>


                <a href="<%= BASE_URL%>/admin/termek-kategoria/<%=c.categoryID%>">
                    <button>Megnyítás</button>
                </a>
            </div>
        <% }) %>
    </div>
</div>

Itt ami nagyon fontos -> <a href="<%= BASE_URL%>/admin/termek-kategoria/<%=c.categoryID%>">
Ha meg van a termék kategóriák, akkor meg lehessen nyitni, minden kategorián belül lesz egy gomb, ami oda visz minket, hogy ...c.categoryID 

ha meg csak simán akarunk egy terméket nem felülírni az adott kategóriát, mint a fenti esetben, akkor meg egy olyanra visz minket, hogy 
termek-kategoria (ezt majd meg kell csinálni, de itt tudunk majd új kategóriát felvinni)
Tehát még nincsen ilyen api endpoint, hogy localhost:3000/admin/termek-kategoria
-> 
csinálunk egy product-category.ejs-t az admin mappába!! 
-> 
<div class="container">
    <form method="POST" class="box" action="<%=baseUrl%>/admin/product-category" >
        <h3>Kategória elnevezése</h3>
        <input type="text" name="categoryName">

        <h3>Kategória leírása</h3>
        <textarea style="width: 180%;min-height: 100px;" name="categoryDesc"></textarea>

        <button>Létrehozás</button>
    </form>
</div>

És ennek kell itt az index-en 
-> 
app.get("/admin/termek-kategoria", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );
        
        res.render("admin/product-category", {
            layout: "./layouts/admin_layout",
            title: "Termék kategória",
            baseUrl: process.env.BASE_URL,
            page: "termek-kategoria", 
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

Az a lényeg, hogy ezeknek meg kell egyeznie 
->
app.get("/admin/termek-kategoria"
és ennek 
<a href="<%= baseUrl%>/admin/termek-kategoria">
!!!!!!!!!!!!!!!!!

Következő, hogy megcsináljuk ezt a post-os endpoint-ot "<%=baseUrl%>/admin/product-category" >
és erre már készen van a ProductCategories-ban az addCategory (átnevezzük most createCategory-nak)

app.post("admin/create-category", async (req, res)=> {
    let response;

    try {
        response = await pc.createCategory(
            req.body,
            req.session.userID,
            req.session.isAdmin
        )
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.success);
    if(success) {
        res.redirect(`/admin/termek-kategoria/${response.insertID}?message=${response.message}&success=${success}`);
    } else {
        res.redirect(`/admin/termek-kategoria/?message=${response.message}&success=${success}`);
    }

És így tudunk felvinni egy terméket, hogyha sikeres volt a felvitel, akkor odamegyünk, hogy ... /${response.insertID}..
Arra a termékre, amit felvittünk 
insertId-t megkapjuk ha sikeres volt a response, itt meg megadjuk az url-be!!! 
->
if(response[0].affectedRows === 1) {
    return {
        status: 200,
        message: ["Sikeres feltöltés!"],
        insertID: response[0].insertID     ****

És itt meg fontos, hogy ennek kell megegyeznie 
-> 
action="<%=baseUrl%>/admin/create-category" >
app.post("admin/create-category"

És most, ha arra kattintunk, hogy létrehozás, akkor megjeleneik a form, amit készítettünk 
localhost:3000/admin/termek-kategoria
Ha itt kitöltjük, megadunk egy termék elnevezést meg egy termék leírása-t, és beküldjük, akkor ide visz minket 
-> 
localhost:3000/admin/termek-kategoria/3/?message=Sikeres%20feltöltés&success=true

Csinálni kell egy ugyanilyet, hogy termek-kategoria csak még hozzá kell csatolni a param-ot is 
mert mi most ide írányítunk át a post-os-ból ha sikerült 
-> 
res.redirect(`/admin/termek-kategoria/${response.insertID}?message=${response.message}&success=${success}`);
tehát ez nekünk itt a válaszunk, de viszont nincs ilyen, ezért kell egy ilyen get-es, ami nagyon hasonló lesz, mint a 
app.get("/admin/termek-kategoria"
csak még hozzá kell adni egy :categoryID-t
A categoryID-t meg a req.params.categoryID-ból fogjuk megszerezni 
-> 
most ugyanazt adta vissza itt az admin/termek-kategoria/3(vagy akármennyi, amit megnyitottuk), mint a termek-kategoria 
csak az itt a különbség, hogy a termek-kategoria, ott akarunk majd felvinni egy terméket 
ha meg termek-kategoria/3 ott meg felülírni azt a terméket, de fontos, hogy majd látható legyen, ki legyen írva a Kategoria elnevezése meg a 
a leírásában, hogy mi az aktuális értéke, amit felül akarunk írni vagy éppen nem 
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
Erre csinálunk egy getCategoryByID-t (ProductCategories.js) és majd itt lesz az update
->
    async getCategoryByID(categoryID) {
        try {
            const response = await conn.promise().query(
                "SELECT * FROM product_categories WHERE categoryID = ?"
                [categoryID]
            );
            return response[0];
        } catch (err) {
            console.log("ProductCategories.getCategoryByID", err);

            if (err.status) {
                throw err;
            }

            throw {
                status: 503,
                message: ["A szolgáltatás jelenleg nem érhető el!"]
            }
        }
    }

    Itt lesz egy categoryData, ami null 
    -> 
    app.get("/admin/termek-kategoria", async (req, res)=> { 
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );
        
        res.render("admin/product-category", {             **************
            layout: "./layouts/admin_layout",
            title: "Termék kategória",
            baseUrl: process.env.BASE_URL,
            page: "termek-kategoria", 
            categoryData: null                              ************* fontos, hogy itt legyen mert ugyanazt render-eljük itt is 

    mert itt van felvitel, itt még nincsen semmi 

    app.get("/admin/termek-kategoria/:categoryID", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );

        const categoryData = await pc.getCategoryByID(req.params.categoryID);         ***************
        console.log(categoryData);                                                    ***************
        
                res.render("admin/product-category", {          ***************
                    layout: "./layouts/admin_layout",
                    title: "Termék kategória",
                    baseUrl: process.env.BASE_URL,
                    page: "termek-kategoria", 
                    categoryData:categoryData                                          **************

itt viszont már leszjük categoryID-ként * az összes dolgot, tehát egy rekordot, ahol a categoryID meg valami
és onnan tudjuk, hogy mi a categoryID, hogy a req.params.categoryID-ból 
mert, amikor megadtuk, hogy insertID, akkor ezt beleraktuk egy URL-be, itt meg hozzáfüztük 
app.get("/admin/termek-kategoria/:categoryID"
getCategoryID meg ezt várja és innen megadjuk neki ->  const categoryData = await pc.getCategoryByID(req.params.categoryID);
categoryData-ban meg lejött az id a name meg a desc és azokat majd megjelenítjük!! 
console.log(categoryData)
{
    categoryID: 1,
    categoryName: 'parfümök', 
    categoryDesc: 'A parfümök arra jók, hogy illatos legyél'
}

ezt meg kell jeleníteni a product-category-ban egy value attributummal!! 
        <h3>Kategória elnevezése</h3>
        <input type="text" 
        name="categoryName"
        value="<%=categoryData.categoryName ? categoryData.categoryName : ''%>">

        <h3>Kategória leírása</h3>
        <textarea style="width: 80%;min-height: 100px;" name="categoryDesc">
            <%=categoryData.categoryDesc ? categoryData.categoryDesc : ''%> 
        </textarea>

Tehát ha létezik a categoryData.categoryName meg a categoryDesc akkor kiírjuk azokat, ha meg nem, akkor egy üres string
Fontos, hogy a textarea esetén ott a kettő közé kell írni nem egy value attributummal 

action="<%=baseUrl%>/admin/create-category/<%=categoryData.categoryID ? categoryData.categoryID : ''%>" >

ilyenkor visszajön erre, csak nincsen olyan post-os endpoint-unk, hogy admin/create-category/1

*/
