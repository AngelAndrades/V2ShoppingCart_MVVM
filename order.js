var resArray = [];

$.getQuery = function( query ) {
    query = query.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var expr = "[\\?&]"+query+"=([^&#]*)";
    var regex = new RegExp( expr );
    var results = regex.exec( window.location.href );
    if( results !== null ) {
        return results[1];
        return decodeURIComponent(results[1].replace(/\+/g, " "));
    } else {
        return false;
    }
};

kendo.data.binders.widget.grid = {
    value: kendo.data.Binder.extend({
        init: function (widget, bindings, options) {
            kendo.data.Binder.fn.init.call(this, widget.element[0], bindings, options);

            this.widget = widget;

            widget.bind("change", $.proxy(this._change, this));
        },
        refresh: function () {
        },
        _change: function () {
            var item = this.widget.select();

            if (item.length) {
                var dataSource = this.widget.dataSource;

                var dataItem = dataSource.getByUid(item.data("uid"));

                if (dataItem) {
                    this.bindings.value.set(dataItem);
                }
            }
        }
    })
};

// Data
var dataAsync = $.ajax({
    method: 'GET',
    url: _spPageContextInfo.webServerRelativeUrl + "/_api/web/lists/getbytitle('Orders')/items?$select=Id,Title,Email,VAMC,Address,Phone,Fax,Order_x0020_ID,Created,OrderStatus,ShippingMethod,TrackingCode,Comments,Modified&$orderby=Created desc&$top=5000",
    beforeSend: function (xhr) {
        xhr.setRequestHeader("Accept", "application/json;odata=verbose")
    }
})
.done(function (data) {

    $.each(data.d.results, function (key, val) {
        var d1 = new Date(val.Created);
        var d2 = new Date(val.Modified);

        var o = {};
        o['id'] = val.Id;
        o['fullname'] = val.Title;
        o['email'] = val.Email;
        o['vamc'] = val.VAMC;
        o['address'] = val.Address;
        o['phone'] = val.Phone;
        o['fax'] = val.Fax;
        o['orderno'] = val.Order_x0020_ID;
        o['orderdate'] = d1.toDateString();
        o['status'] = val.OrderStatus;
        o['shipmethod'] = val.ShippingMethod;
        o['tracking'] = val.TrackingCode;
        o['comments'] = val.Comments;
        o['modified'] = d2.toDateString();

        resArray.push(o);
    });

});

var gridModel;

$.when(dataAsync).then(function () {
    // Data
    var orders = new kendo.data.DataSource({
        schema: { model: {} },
        data: resArray,
        pageSize: 10,
        page: 1
    });

    // Model
    gridModel = kendo.observable({
        orders: orders,
        selectedItem: {},

        getOrderInfo: function(e) {
            e.preventDefault();

            var obj = e.currentTarget.parentElement.parentElement;
            formModel.set('formdata', $("#grid").data("kendoGrid").dataItem(obj));
            getItemsOrdered(formModel.formdata.orderno);
        }
    });

    var formModel = kendo.observable({
        formdata: {},
        orderdata: {},
        orderstatus: new kendo.data.DataSource({
            data: [
                { 'text': '' },
                { 'text': 'Pending' },
                { 'text': 'Shipped' },
                { 'text': 'Cancelled' }
            ]
        }),
        shippingmethod: new kendo.data.DataSource({
            data: [
                { 'text': '' },
                { 'text': 'FedEx' },
                { 'text': 'UPS' },
                { 'text': 'USPS' }
            ]
        }),

        getOrders: function (e) {
            e.preventDefault();

            if(this.formdata.status !== '') $('#ddStatus').data('kendoDropDownList').text('');
            $('#ddShipMethod').data('kendoDropDownList').text('');

            spaorders.navigate('/');
            $("#grid").data("kendoGrid").dataSource.sync();
        },

        updateOrder: function(e) {
            e.preventDefault();
            
            var digest = getFormDigest();
            $.when(digest).then(function () {
                var newDigest = digest.responseJSON.d.GetContextWebInformation.FormDigestValue;

                updateOrder(e.data.formdata, newDigest);

                $('<div></div>').kendoAlert({
                    title: 'Saving updates...',
                    content: 'Order has been updated and the customer has been notified.'
                }).data('kendoAlert').open();
            })
        }
    });

    function getItemsOrdered(id) {
        var dataAsync = $.ajax({
            method: 'GET',
            url: _spPageContextInfo.webServerRelativeUrl + "/_api/web/lists/GetByTitle('Items%20Ordered')/items?$select=ItemName,ItemNo,Quantity&$filter=Title eq '" + id + "'",
            beforeSend: function (xhr) {
                xhr.setRequestHeader("Accept", "application/json;odata=verbose")
            }
        })
        .then(function(data){
            var tempArray = [];

            $.each(data.d.results, function(key,val){
                var tempobj = {};

                tempobj['itemname'] = val.ItemName;
                tempobj['itemno'] = val.ItemNo;
                tempobj['quantity'] = val.Quantity;

                tempArray.push(tempobj);
            });

            var details = new kendo.data.DataSource({
                schema: { model: {} },
                data: tempArray
            });

            formModel.set('orderdata',details);
            spaorders.navigate('/order');
        })
    };

    function updateOrder(data, digestHeader) {
        var tempShipMethod = '';
        if (typeof (data.shipmethod) === 'object' && data.shipmethod !== null) tempShipMethod = data.shipmethod.text;
        if (typeof (data.shipmethod) === 'string' && data.shipmethod !== '') tempShipMethod = data.shipmethod;

        $.ajax({
            url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/GetByTitle('Orders')/items(" + data.id + ")",
            method: 'PATCH',
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
                OrderStatus: (typeof (data.status) === 'object') ? data.status.text : data.status,
                ShippingMethod: tempShipMethod,
                TrackingCode: data.tracking,
                Comments: data.comments
            }),
            headers: {
                'Accept': 'application/json;odata=verbose',
                'Content-Type': 'application/json;odata=verbose',
                'X-RequestDigest': digestHeader,
                'X-HTTP-Method': 'POST',
                'IF-MATCH': '*',
                'X-HTTP-Method': 'PATCH'
            },
            success: function (data, status, xhr) {
                console.log(data, status, xhr);
            },
            error: function (xhr, status, error) {
                console.log(xhr, status, error);
            }
        });
        
    };

    //functions
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
    var layout = new kendo.Layout("layout-template");

    // Views
    var index = new kendo.View("index-template", { model: gridModel });
    var orderDetails = new kendo.View("details-template", { model: formModel });

    // Router
    var spaorders = new kendo.Router({
        init: function () {
            layout.render("#application");
        }
    });

    // Routes
    spaorders.route("/", function () {
        layout.showIn("#appcontent", index);
        if ($.getQuery('orderno') !== false) orders.filter({ field: 'orderno', operator: 'equals', value: $.getQuery('orderno') });
    });

    spaorders.route("/order", function() {
        layout.showIn("#appcontent", orderDetails);
    });

    $(function () {
        spaorders.start();
    });
});