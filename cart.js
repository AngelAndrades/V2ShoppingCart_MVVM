//Disable the back button behavior
history.pushState(null, null, location.href);
window.onpopstate = function () {
    history.go(1);
    $('#checkout').show();
};

var resArray = [];
var addressArray = [];

// Data
var dataAsync = $.ajax({
        method: 'GET',
        url: _spPageContextInfo.webServerRelativeUrl + "/_api/web/lists/getbytitle('Catalog')/items?$select=ID,Title,OData__Comments,Inventory,Category,Min_x0020_Quantity,FileRef,Item_x0020_No,Link_x0020_to_x0020_PDF&$top=1000",
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Accept", "application/json;odata=verbose")
        }
    })
    .done(function (data) {

        $.each(data.d.results, function (key, val) {
            var o = {};
            o['id'] = val.Id;
            o['category'] = val.Category;
            o['image'] = val.FileRef;
            o['inventory'] = val.Inventory;
            o['min_quantity'] = val.Min_x0020_Quantity;
            o['description'] = val.OData__Comments;
            o['title'] = val.Title;
            o['itemno'] = val.Item_x0020_No;
            o['pdf'] = val.Link_x0020_to_x0020_PDF;

            resArray.push(o);
        });
    });

var addressAsync = $.ajax({
        method: 'GET',
        url: _spPageContextInfo.webServerRelativeUrl + "/_api/web/lists/getbytitle(%27Locations%27)/items?$select=Title,Facility,Address,State,Type1&$top=1000&$orderby=Facility",
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Accept", "application/json;odata=verbose")
        }
    })
    .done(function (data) {
        addressArray = data.d.results.slice();
    });


$.when(dataAsync, addressAsync).then(function () {
    var items = new kendo.data.DataSource({
        schema: {
            model: {}
        },
        data: resArray,
        pageSize: 10,
        page: 1,
        sort: {
            field: 'title',
            dir: 'asc'
        }
    });

    var addresses = new kendo.data.DataSource({
        schema: {
            model: {}
        },
        data: addressArray,
        sort: {
            field: 'Facility',
            dir: 'asc'
        }
    });

    // Model
    var cart = kendo.observable({
        contents: [],
        cleared: false,
        searchItem: '',

        contentsCount: function () {
            return this.get("contents").length;
        },

        add: function (item) {
            var found = false;
            this.set("cleared", false);

            for (var i = 0; i < this.contents.length; i++) {
                var current = this.contents[i];
                if (current.item === item) {
                    if (current.get("quantity") < item.inventory) current.set("quantity", current.get("quantity") + item.min_quantity);
                    //if (current.get("quantity") < item.inventory) current.set("quantity", item.quantity);
                    else {
                        $('<div></div>').kendoAlert({
                            title: 'Shopping Cart Alert',
                            content: 'Your order cannot exceed what is available in inventory.'
                        }).data('kendoAlert').open();
                    }
                    found = true;
                    break;
                }
            }

            if (!found) {
                if (item.inventory > 0) this.contents.push({
                    item: item,
                    quantity: item.min_quantity
                });
                //if (item.inventory > 0) this.contents.push({ item: item, quantity: item.quantity });
                else {
                    if (this.contentsCount() == 0) layout.showIn('#sect-cart-info', new kendo.View(''));

                    $('<div></div>').kendoAlert({
                        title: 'Shopping Cart Alert',
                        content: 'The item you selected is not in stock. Contact the VISN Communications Office for further assistance.'
                    }).data('kendoAlert').open();
                }
            }
        },

        remove: function (item) {
            for (var i = 0; i < this.contents.length; i++) {
                var current = this.contents[i];
                if (current === item) {
                    this.contents.splice(i, 1);
                    break;
                }
            }
        },

        empty: function () {
            var contents = this.get("contents");
            contents.splice(0, contents.length);
        },

        clear: function () {
            var contents = this.get("contents");
            contents.splice(0, contents.length);
            this.set("cleared", true);
        }
    });

    var layoutModel = kendo.observable({
        cart: cart
    });

    var cartPreviewModel = kendo.observable({
        cart: cart,

        cartContentsClass: function () {
            return this.cart.contentsCount() > 0 ? "active" : "empty";
        },

        removeFromCart: function (e) {
            this.cart.remove(e.data);
            if (this.cart.contentsCount() == 0) cartPreview.hide();
        },

        emptyCart: function () {
            $('#checkout').show();
            cartPreview.hide();
            cart.empty();
            spacart.navigate('/');
        },

        proceed: function (e) {
            spacart.navigate("/customer");

            $.ajax({
                    method: 'GET',
                    url: _spPageContextInfo.webServerRelativeUrl + "/_api/web/currentuser",
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader("Accept", "application/json;odata=verbose")
                    }
                })
                .done(function (data) {
                    $('#fullname').val(data.d.Title);
                    $('#email').val(data.d.Email);

                    customerModel.fullname = data.d.Title;
                    customerModel.email = data.d.Email;
                })
        },

        checkout: function (e) {
            spacart.navigate('/checkout');
        },

        continueShopping: function (e) {
            spacart.navigate('/');
        }
    });

    var indexModel = kendo.observable({
        items: items,
        cart: cart,

        addToCart: function (e) {
            e.preventDefault();
            if (cart.contentsCount() > -1) layout.showIn('#sect-cart-info', cartPreview);

            //if ($('#sect-cart-info').is(':empty')) layout.showIn("#sect-cart-info", cartPreview);
            cart.add(e.data);
        },

        filterItems: function (e) {
            e.preventDefault();
            items.filter({
                field: 'title',
                operator: 'contains',
                value: this.searchItem
            });
        },

        clearFilter: function (e) {
            e.preventDefault();
            items.filter({});
            this.set('searchItem', '');
        }
    });

    var detailModel = kendo.observable({
        imgUrl: function () {
            return this.get("current").image
        },

        pdfLink: function () {
            if (this.get("current").pdf !== null) return '<br /><a href="' + this.get("current").pdf + '" target="_blank"><img src="' + _spPageContextInfo.webServerRelativeUrl + '/SiteAssets/images/iconpdf.gif" alt="PDF Icon" />&nbsp;&nbsp;View PDF</a>';
            else return '';
        },

        addToCart: function (e) {
            e.preventDefault();
            if (cart.contentsCount() > -1) layout.showIn('#sect-cart-info', cartPreview);
            //if ($('#sect-cart-info').is(':empty')) layout.showIn("#sect-cart-info", cartPreview);
            cart.add(this.get("current"));
        },

        continueShopping: function (e) {
            spacart.navigate('/');
        },

        setCurrent: function (itemID) {
            this.set("current", items.get(itemID));
        },

        previousHref: function () {
            var id = this.get("current").id - 1;
            if (id === 0) {
                id = items.data().length;
            }

            return "#/menu/" + id;
        },

        nextHref: function () {
            var id = this.get("current").id + 1;

            if (id > items.data().length) {
                id = 1;
            }

            return "#/menu/" + id;
        }
    });

    var customerModel = kendo.observable({
        orderId: $.md5(this.firstName + this.latName + new Date()),
        siteid: '',
        vamc: '',
        address: '',
        state: '',

        submitOrder: function (e) {
            e.preventDefault();

            var validator = $('#customer_info').kendoValidator().data('kendoValidator');
            var status = $("#status");
            var formData = this;

            if (validator.validate()) {
                var digest = getFormDigest();

                $.when(digest).then(function () {
                    var newDigest = digest.responseJSON.d.GetContextWebInformation.FormDigestValue;

                    submitOrder(formData, newDigest, 'Pending');
                    submitItems(cart.contents, formData.orderId, newDigest, 'Adjusted');

                    $('<div></div>').kendoAlert({
                        title: 'Thank you for your order',
                        content: 'The order has been submitted. You will receive an Outlook email message for order tracking.',
                        close: function () {
                            spacart.navigate('/home');
                        }
                    }).data('kendoAlert').open();
                })
            } else {
                status.text('Please populate all the required fields.');
            }

        }
    });

    var ddModel = kendo.observable({
        categories: new kendo.data.DataSource({
            data: [{
                    'category': 'All',
                    'value': ''
                },
                {
                    'category': 'Employees',
                    'value': 'Employees'
                },
                {
                    'category': 'Patient Education',
                    'value': 'Patient Education'
                },
                {
                    'category': 'Stakeholder Information',
                    'value': 'Stakeholder Information'
                },
                {
                    'category': 'Veteran Information',
                    'value': 'Veteran Information, Veterans Benefits, Outreach to Veterans'
                }
            ]
        }),
        selectedCategory: '',
        onChange: function () {
            if (this.get('selectedCategory') !== '') items.filter({
                field: 'category',
                operator: 'equals',
                value: this.get('selectedCategory')
            });
            else items.filter({});
        }
    });

    var typeModel = kendo.observable({
        locType: new kendo.data.DataSource({
            data: [{
                    'sitetype': 'VISN Office',
                    'value': 'VISN Office'
                },
                {
                    'sitetype': 'VA Medical Center',
                    'value': 'VAMC'
                },
                {
                    'sitetype': 'CBOC',
                    'value': 'CBOC'
                }
            ]
        }),
        selectedType: '',
        onChange: function () {
            if (this.get('selectedType') !== '') addresses.filter({
                field: 'Type1',
                operator: 'equals',
                value: this.get('selectedType')
            });
            else addresses.filter({});
        }
    });

    var addressModel = kendo.observable({
        addresses: addresses,
        selectedAddress: '',
        onChange: function () {
            var selected = this.get('selectedAddress');

            if (addresses.view().filter(function (e) {
                    if (e.Title === selected) {
                        //console.log(e);
                        //Update Model
                        customerModel.siteid = e.Title;
                        customerModel.vamc = e.Facility;
                        customerModel.address = e.Address;
                        customerModel.state = e.State;
                        //Update Form elements directly - these elements have separate models
                        $('#siteid').val(e.Title);
                        $('#address').val(e.Address);
                        $('#state').val(e.State);
                    }
                }));
        }
    });

    // SharePoint CRUD
    function submitItems(data, orderId, digestHeader, inventoryStatus) {
        $.each(data, function (key, val) {
            $.ajax({
                url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/GetByTitle('Items Ordered')/items",
                method: 'POST',
                data: JSON.stringify({
                    __metadata: {
                        type: 'SP.Data.Items_x0020_OrderedListItem'
                    },
                    Title: orderId,
                    ItemName: val.item.title,
                    ItemNo: val.item.itemno,
                    Quantity: val.quantity,
                    InventoryStatus: inventoryStatus
                }),
                headers: {
                    'Accept': 'application/json;odata=verbose',
                    'Content-Type': 'application/json;odata=verbose',
                    'X-RequestDigest': digestHeader,
                    'X-HTTP-Method': 'POST'
                },
                success: function (data, status, xhr) {
                    console.log(data, status, xhr);
                },
                error: function (xhr, status, error) {
                    console.log(xhr, status, error);
                }
            })
        });
    };

    function submitOrder(data, digestHeader, orderStatus) {
        //console.log(data);
        $.ajax({
            url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/GetByTitle('Orders')/items",
            method: 'POST',
            data: JSON.stringify({
                __metadata: {
                    type: 'SP.Data.OrdersListItem'
                },
                Title: data.fullname,
                Email: data.email,
                VAMC: data.vamc,
                SiteID: data.siteid,
                Address: data.address,
                State: data.state,
                Phone: data.phone,
                Fax: data.fax,
                Order_x0020_ID: data.orderId,
                OrderStatus: orderStatus
            }),
            headers: {
                'Accept': 'application/json;odata=verbose',
                'Content-Type': 'application/json;odata=verbose',
                'X-RequestDigest': digestHeader,
                'X-HTTP-Method': 'POST'
            },
            success: function (data, status, xhr) {
                console.log(data, status, xhr);
            },
            error: function (xhr, status, error) {
                console.log(xhr, status, error);
            }
        });
    };

    function getFormDigest() {
        return $.ajax({
            url: _spPageContextInfo.webAbsoluteUrl + '/_api/contextinfo',
            method: 'POST',
            headers: {
                'Accept': 'application/json;odata=verbose'
            }
        })
    }

    // Layout
    var layout = new kendo.Layout("layout-template", {
        model: layoutModel
    });
    var cartPreview = new kendo.Layout("cart-preview-template", {
        model: cartPreviewModel
    });

    // Views
    var index = new kendo.View("index-template", {
        model: indexModel
    });
    var checkout = new kendo.View("checkout-template", {
        model: cartPreviewModel
    });
    var detail = new kendo.View("detail-template", {
        model: detailModel
    });
    var customer = new kendo.View('customer-template', {
        model: customerModel
    });

    var viewingDetail = false;

    // Router
    var spacart = new kendo.Router({
        init: function () {
            layout.render("#application");
        }
    });

    // Routes
    spacart.route("/", function () {
        viewingDetail = false;
        layout.showIn("#appcontent", index);
        if (cart.contentsCount() > 0) layout.showIn('#sect-cart-info', cartPreview);
        kendo.bind($('#ddfilter'), ddModel);
    });

    spacart.route("/home", function () {
        location.replace("/sites/VHAV2cartapp");
    })

    spacart.route("/checkout", function () {
        viewingDetail = false;
        layout.showIn("#appcontent", checkout);
        cartPreview.hide();
    });

    spacart.route("/customer", function () {
        if ($('#sect-cart-info').is(':empty')) layout.showIn("#sect-cart-info", cartPreview);
        viewingDetail = false;
        kendo.bind($("customer_info"), customerModel);
        layout.showIn("#appcontent", customer);
        $('#checkout').hide();

        kendo.bind($('#ddType'), typeModel);
        kendo.bind($('#ddLocation'), addressModel);
    });

    spacart.route("/menu/:id", function (itemID) {
        var transition = "",
            current = detailModel.get("current");

        if (viewingDetail && current) {
            if (current.id === 19 && itemID == 1) {
                transition = "tileleft";
            } else if (current.id === 1 && itemID == 19) {
                transition = "tileright";
            } else {
                transition = current.id < itemID ? "tileleft" : "tileright";
            }
        }

        items.fetch(function (e) {
            if (detailModel.get("current")) { // existing view, start transition, then update content. This is necessary for the correct view transition clone to be created.
                layout.showIn("#appcontent", detail, transition);
                detailModel.setCurrent(itemID);
            } else {
                // update content first
                detailModel.setCurrent(itemID);
                layout.showIn("#appcontent", detail, transition);
            }
        });

        //var templ = kendo.template($('#doclink').html());
        //$('#doclinktemplate').html(templ({ current }));

        viewingDetail = true;
    });

    $(function () {
        spacart.start();
    });

});