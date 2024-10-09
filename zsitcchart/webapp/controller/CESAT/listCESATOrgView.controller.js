sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/table/Table",
    "sap/ui/table/Column", "sap/m/Text", "sap/m/Label",
    "sap/ui/model/json/JSONModel",
    "sap/ui/unified/Currency",
    'sap/m/OverflowToolbar',
    'sap/m/ToolbarSpacer',
    'sap/m/Button',
    'sap/ui/export/Spreadsheet',
    'sap/ui/export/library'
  ],
  function (BaseController, History, Filter, FilterOperator, Table, Column, Text, Label, JSONModel, Currency, OverflowToolbar,
    ToolbarSpacer, Button, Spreadsheet, exportLibrary
  ) {
    "use strict";

    return BaseController.extend("zdemowithpar.controller.CESAT.listCESATOrgView", {
      onInit() {
        this.getOwnerComponent().getRouter().getRoute("listCESATOrg").attachMatched(this._onRouteMatched, this);
      },

      _onRouteMatched(oEvent) {
        const oCESATModel = this.getOwnerComponent().getModel('ZSB_CESAT_001');

        oCESATModel.attachRequestSent((oEvent) => {
          debugger
          this.byId('idPageCompanyList').setBusy(true);
          if (oEvent.getParameter('url').indexOf('companyCesat') === 0) {
            this.byId('idCompanyListTable').setBusy(true);
          }
        });

        oCESATModel.attachRequestCompleted(() => {
          console.log("OData request completed");
          this.byId('idPageCompanyList').setBusy(false);
        });

        oCESATModel.attachRequestFailed(oEvent => {
          const oError = oEvent.getParameter("response");
          console.error("OData request failed", oError);
          this.byId('idCompanyListTable').setBusy(false);
        });
        this.loadData(oEvent);
      },

      loadData: async function (oEvent) {

        let oModel = this.getOwnerComponent().getModel();
        const oCESATModel = this.getOwnerComponent().getModel('ZSB_CESAT_001');
        let oYearSelect = this.byId('idYearSelectList');
        oYearSelect.setEditable(false);
        let oWeekSelect = this.byId("idWeekSelectList");
        oWeekSelect.setEditable(false);
        // 1. 绑定年数据 
        oYearSelect.setModel(oModel);
        oYearSelect.bindItems({
          path: '/year',
          sorter: {
            path: 'Zyear',
            descending: false
          },
          template: new sap.ui.core.Item({
            key: "{Zyear}",
            text: "{Zyear}"
          })
        });

        const oArgs = oEvent.getParameter("arguments");
        const sSelectYears = oArgs.years;
        const sSelectWeek = oArgs.week;

        var aSelectedYearKeys = sSelectYears.match(/.{1,4}/g);
        this._aSelectedYearKeys = aSelectedYearKeys;
        oYearSelect.setSelectedKeys(aSelectedYearKeys);
        const aYearFilters = aSelectedYearKeys.map(sYear => new Filter("Zyear", FilterOperator.EQ, sYear));
        const oYearFilter = new Filter({
          filters: aYearFilters,
          and: false
        });
        this._oYearFilter = oYearFilter;

        oWeekSelect.setModel(oModel);
        const oFilter = new sap.ui.model.Filter("Zyear", sap.ui.model.FilterOperator.EQ, aSelectedYearKeys[0]);
        oWeekSelect.bindItems({
          path: '/yearweek',
          sorter: {
            path: 'Zweek',
            descending: false
          },
          template: new sap.ui.core.Item({
            key: "{Zweek}",
            text: "{Zweek}"
          })
        });
        oWeekSelect.setSelectedKey(sSelectWeek);
        this._sSelectWeek = sSelectWeek;

        const sOrgSelect = window.decodeURIComponent(oArgs.org);
        const oOrgSelect = this.byId('idOrgSelectList');
        oOrgSelect.bindItems({
          path: 'ZSB_CESAT_001>/org',
          template: new sap.ui.core.ListItem({
            key: "{ZSB_CESAT_001>Ddtext}",
            text: "{ZSB_CESAT_001>Ddtext}",
          })
        });
        await new Promise((resolve, reject) => {
          const oBinding = oOrgSelect.getBinding("items");
          if (oBinding) {
            oBinding.attachDataReceived(function () {
              resolve();
            });
          } else {
            reject("Year binding failed");
          }
        });
        oOrgSelect.setSelectedKeys([sOrgSelect]);
        const oOrgFilter = new Filter({
          filters: [sOrgSelect].map(sOrg => new Filter('Ddtext', FilterOperator.EQ, sOrg)),
          and: false
        })

        //公司代码默认
        const oCompanySelect = this.byId('idCompanySelectList')
        oCompanySelect.bindItems({
          path: 'ZSB_CESAT_001>/companyOrg',
          length: 999,
          filters: [new Filter("Ddtext", FilterOperator.EQ, sOrgSelect)],
          template: new sap.ui.core.ListItem({
            key: "{ZSB_CESAT_001>Bukrs}",
            text: "{ZSB_CESAT_001>butxt} ({ZSB_CESAT_001>Bukrs})"
          })
        });

        await new Promise((resolve, reject) => {
          const oCompanyBinding = oCompanySelect.getBinding("items");
          if (oCompanyBinding) {
            oCompanyBinding.attachDataReceived(function () {
              resolve();
            });
          } else {
            reject("Year binding failed");
          }
        });
        oCompanySelect.setSelectedKeys(oCompanySelect.getItems().map(oItem => oItem.getKey()));
        const oCompanyFilter = new Filter({
          filters: oCompanySelect.getItems().map(oCompany => new Filter('bukrs', FilterOperator.EQ, oCompany.getKey())),
          and: false
        })

        this._fillDataIntoTable(oYearFilter, oOrgFilter, sSelectWeek, oCompanyFilter, aSelectedYearKeys);

      },

      _fillDataIntoTable(oYearFilter, oOrgFilter, sWeekFilter, oCompanyFilter, aSelectedYearKeys) {
        //debugger;
        const oModel = this.getOwnerComponent().getModel('ZSB_CESAT_001');
        oModel.metadataLoaded().then(() => {
          const sPath = "/companyCesat(p_ZWEEK='" + sWeekFilter + "')/Set";

          const oCombinedFilter = new Filter({
            filters: [oYearFilter, oOrgFilter, oCompanyFilter],
            and: true,
          });
          debugger
          oModel.read(sPath, {
            filters: [oCombinedFilter],
            urlParameters: { "$top": "9999999" },
            success: (oData) => {
              debugger
              let aJsonResult = { 'company': this._convertOdataModelToJsonModel(oData, aSelectedYearKeys) };
              this.getView().setModel(new JSONModel(aJsonResult), 'viewCompanyModel');
              this._fillTable(aSelectedYearKeys);
              this.byId('idCompanyListTable').setBusy(false);
            },
            error: (oError) => {
              debugger
              console.info(oError);
              this.byId('idCompanyListTable').setBusy(false);
            }
          })
        })
      },

      _fillTable(aSelectedYearKeys) {
        const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
        const oCompanyTable = this.byId('idCompanyListTable');
        oCompanyTable.destroyColumns();
        oCompanyTable.destroyExtension();
        //oCompanyTable.destroyRows() 

        const addColumn = (labelText, bindingPath, wrapping = true, formatter = null) => {
          const oColumn = new Column({
            width: 'auto',
            label: new Label({
              text: oResourceBundle.getText(labelText)
            }),
            template: new Text({
              text: formatter ? {
                parts: bindingPath.map(path => ({ path: `viewCompanyModel>${path}` })),
                formatter: formatter
              } : `{viewCompanyModel>${bindingPath[0]}}`,
              wrapping: wrapping
            })
          });
          oCompanyTable.addColumn(oColumn);
        };

        //addColumn('Org', ['org']);
        addColumn('OrgName', ['Ddtext']);
        addColumn('companyCode', ['bukrs']);
        addColumn('companyCodeName', ['butxt'], false);
        addColumn('currency', ['usdcurr'], false);
        aSelectedYearKeys.forEach(year => {
          addColumn(year, [year, 'usdcurr'], false, (amountStr, currency) => {
            const amount = parseFloat(amountStr);
            if (!isNaN(amount)) {
              // return sap.ui.core.format.NumberFormat.getCurrencyInstance().format(amount, currency);
              return amount.toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            }
            return "0.00";
          });
        });
        this._aSelectedYearKeys = aSelectedYearKeys;

        const overflowToolbar = new OverflowToolbar();
        overflowToolbar.addContent(new ToolbarSpacer());
        const oBtnExport = new Button({
          text: oResourceBundle.getText('ExportFile'),
          icon: 'sap-icon://download',
          press: this.onExport.bind(this)
        });
        overflowToolbar.addContent(oBtnExport);
        oCompanyTable.addExtension(overflowToolbar);
      },

      onExport(aSelectedYearKeys) {
        const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

        const oTable = this.byId('idCompanyListTable');
        const oRowBinding = oTable.getBinding('rows');

        let aCols = this.createColumnConfig();
        let oSettings = {
          workbook: {
            columns: aCols
          },
          dataSource: oRowBinding,
          fileName: oResourceBundle.getText('titleofchart')
        };

        let oSheet = new Spreadsheet(oSettings);
        oSheet.build().finally(function () {
          oSheet.destroy();
        });

      },

      createColumnConfig() {
        const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
        let aCols = [];

        aCols.push({
          label: oResourceBundle.getText('OrgName'),
          property: 'Ddtext',
          type: exportLibrary.EdmType.String
        });

        aCols.push({
          label: oResourceBundle.getText('companyCode'),
          property: 'bukrs',
          type: exportLibrary.EdmType.String
        });

        aCols.push({
          label: oResourceBundle.getText('companyCodeName'),
          property: 'butxt',
          type: exportLibrary.EdmType.String,
          width: 50
        });

        aCols.push({
          label: oResourceBundle.getText('currency'),
          property: 'usdcurr',
          type: exportLibrary.EdmType.String
        });

        this._aSelectedYearKeys.forEach(year => {
          aCols.push({
            property: year,
            type: exportLibrary.EdmType.Number,
            scale: 2,
            delimiter: true,
            width: 20
          });
        })

        return aCols;
      },

      _convertOdataModelToJsonModel(oData, years) {
        const result = [];
        const map = new Map();

        oData.results.forEach(item => {
          const key = `${item.org}-${item.bukrs}`;
          if (!map.has(key)) {
            let newObj = {
              Ddtext: item.Ddtext,
              usdcurr: item.usdcurr,
              butxt: item.butxt,
              org: item.org,
              bukrs: item.bukrs
            };
            years.forEach(year => {
              newObj[year] = 0.00;
            });
            map.set(key, newObj);
          }
          map.get(key)[item.Zyear] = item.usdamount;
        });

        result.push(...map.values());
        return result;
      },

      onOrgChangeFinish() {
        const aCompanySelected = this.byId('idCompanySelectList').getSelectedKeys();
        const aOrgSelected = this.byId('idOrgSelectList').getSelectedKeys();
        debugger
        const oCompanyFilter = new Filter({
          filters: aCompanySelected && aCompanySelected.length > 0 ? aCompanySelected.map(company => new Filter('bukrs', FilterOperator.EQ, company)) :
            [new Filter('bukrs', FilterOperator.EQ, '')],
          and: false
        })

        const oOrgFilter = new Filter({
          filters: aOrgSelected && aOrgSelected.length > 0 ? aOrgSelected.map(org => new Filter('Ddtext', FilterOperator.EQ, org)) :
            [new Filter('Ddtext', FilterOperator.EQ, '')],
          and: false
        })

        this.byId('idCompanySelectList').bindItems({
          path: 'ZSB_CESAT_001>/companyOrg',
          length: 9999,
          filters: [oOrgFilter],
          template: new sap.ui.core.ListItem({
            key: "{ZSB_CESAT_001>Bukrs}",
            text: "{ZSB_CESAT_001>butxt} ({ZSB_CESAT_001>Bukrs})"
          })
        });

        this._setCompanyCodeSelectKeys(aCompanySelected);

        const oModel = this.getOwnerComponent().getModel('ZSB_CESAT_001');
        oModel.metadataLoaded().then(() => {
          const sPath = "/companyCesat(p_ZWEEK='" + this._sSelectWeek + "')/Set";

          const oCombinedFilter = new Filter({
            filters: [this._oYearFilter, oOrgFilter, oCompanyFilter],
            and: true,
          });
          debugger
          oModel.read(sPath, {
            filters: [oCombinedFilter],
            urlParameters: { "$top": "9999999" },
            success: (oData) => {
              debugger
              let aJsonResult = { 'company': this._convertOdataModelToJsonModel(oData, this._aSelectedYearKeys) };
              this.getView().setModel(new JSONModel(aJsonResult), 'viewCompanyModel');
              this.byId('idCompanyListTable').setBusy(false);
            },
            error: (oError) => {
              debugger
              console.info(oError);
              this.byId('idCompanyListTable').setBusy(false);
            }
          })
        })
      },

      onCompanyCodeChangeFinish() {
        const aCompanySelected = this.byId('idCompanySelectList').getSelectedKeys();
        const aOrgSelected = this.byId('idOrgSelectList').getSelectedKeys();
        debugger
        const oCompanyFilter = new Filter({
          filters: aCompanySelected && aCompanySelected.length > 0 ? aCompanySelected.map(company => new Filter('bukrs', FilterOperator.EQ, company)) :
            [new Filter('bukrs', FilterOperator.EQ, '')],
          and: false
        })

        const oOrgFilter = new Filter({
          filters: aOrgSelected && aOrgSelected.length > 0 ? aOrgSelected.map(org => new Filter('Ddtext', FilterOperator.EQ, org)) :
            [new Filter('Ddtext', FilterOperator.EQ, '')],
          and: false
        })

        const oModel = this.getOwnerComponent().getModel('ZSB_CESAT_001');
        oModel.metadataLoaded().then(() => {
          const sPath = "/companyCesat(p_ZWEEK='" + this._sSelectWeek + "')/Set";

          const oCombinedFilter = new Filter({
            filters: [this._oYearFilter, oOrgFilter, oCompanyFilter],
            and: true,
          });

          oModel.read(sPath, {
            filters: [oCombinedFilter],
            urlParameters: { "$top": "9999999" },
            success: (oData) => {
              //debugger
              let aJsonResult = { 'company': this._convertOdataModelToJsonModel(oData, this._aSelectedYearKeys) };
              this.getView().setModel(new JSONModel(aJsonResult), 'viewCompanyModel');
              this.byId('idCompanyListTable').setBusy(false);
              debugger
            },
            error: (oError) => {
              console.info(oError);
              this.byId('idCompanyListTable').setBusy(false); debugger
            }
          })
        })
      },

      _setCompanyCodeSelectKeys: async function (aCompanyCodeSelectKeys) {
        const oCompanySelect = this.byId('idCompanySelectList')
        await new Promise((resolve, reject) => {
          const oCompanyBinding = oCompanySelect.getBinding("items");
          if (oCompanyBinding) {
            oCompanyBinding.attachDataReceived(function () {
              resolve();
            });
          } else {
            reject("Year binding failed");
          }
        });

        oCompanySelect.setSelectedKeys(aCompanyCodeSelectKeys);
      },

      onNavBack: function () {
        var oHistory, sPreviousHash;

        oHistory = History.getInstance();
        sPreviousHash = oHistory.getPreviousHash();

        if (sPreviousHash !== undefined) {
          window.history.go(-1);
        } else {
          this.getOwnerComponent().getRouter().navTo("RouteView", {}, true /*no history*/);
        }
      }
    });
  }
);