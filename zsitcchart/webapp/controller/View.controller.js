sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/viz/ui5/controls/VizFrame",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/controls/common/feeds/FeedItem"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, Filter, FilterOperator, JSONModel, VizFrame, FlattenedDataset, FeedItem
    ) {
        "use strict";

        return Controller.extend("zdemowithpar.controller.View", {
            oVizFrame: null,
            onInit: function () {
                // 获取OData模型
                let oModel = this.getOwnerComponent().getModel();
                let oYearSelect = this.byId('idYearSelect');
                oYearSelect.setModel(oModel);
                oYearSelect.bindItems({
                    path: '/year',
                    template: new sap.ui.core.Item({
                        key: "{Zyear}",
                        text: "{Zyear}"
                    })
                });
                const sCurrentYear = new Date().getFullYear().toString();
                oYearSelect.setSelectedKey(sCurrentYear);

                const oWeekSelect = this.byId("idWeekSelect");
                oWeekSelect.setModel(oModel);
                const oFilter = new Filter("Zyear", FilterOperator.EQ, sCurrentYear);
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

                let oBinding = oWeekSelect.getBinding("items");
                oBinding.filter([oFilter]);

                let sCurrentWeek = '00';
                oModel.metadataLoaded().then(() => {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = (today.getMonth() + 1).toString().padStart(2, '0');
                    const day = today.getDate().toString().padStart(2, '0');
                    const currentDate = year + '-' + month + '-' + day;
                    const aFilters = [
                        new sap.ui.model.Filter("Bgday", sap.ui.model.FilterOperator.LE, currentDate),
                        new sap.ui.model.Filter("Edday", sap.ui.model.FilterOperator.GE, currentDate)
                    ];

                    return new Promise((resolve, reject) => {
                        oModel.read("/yearweek", {
                            filters: aFilters,
                            success: (oData) => {
                                if (oData.results) {
                                    sCurrentWeek = oData.results[0].Zweek;
                                    oWeekSelect.setSelectedKey(oData.results[0].Zweek);
                                    resolve(oData);
                                }
                            },
                            error: (oError) => {
                                reject(oError);
                            }
                        })
                    });
                }).then(() => {
                    return new Promise((resolve, reject) => {
                        oModel.metadataLoaded().then(() => {
                            const sPath = "/costType(p_ZYEAR='" + sCurrentYear + "',p_ZWEEK='" + sCurrentWeek + "')/Set"
                            oModel.read(sPath, {
                                success: (oData) => {
                                    this._drawChart(oData);
                                },
                                error: (oError) => {
                                    debugger
                                }
                            });
                        })
                    });
                }).catch((oError) => {

                });

            },

            onYearChanged: function (oEvent) {
                const sSelectedYear = oEvent.getSource().getSelectedKey();
                const oWeekSelect = this.byId("idWeekSelect")
                const oFilter = new Filter("Zyear", FilterOperator.EQ, sSelectedYear);
                const oBinding = oWeekSelect.getBinding("items");
                oBinding.filter([oFilter]);

                let sWeekSelect = oWeekSelect.getSelectedKey();
                oBinding.attachEventOnce('dataReceived', (oEvent) => {
                    const oData = oEvent.getParameter("data");
                    if (oData && oData.results && oData.results.length > 0) {
                        const bExists = oData.results.some(function (item) {
                            return item['Zweek'] === sWeekSelect;
                        });

                        if (!bExists) {
                            sWeekSelect = '1'
                        }
                    }
                    const oDataModel = this.getOwnerComponent().getModel();
                    oDataModel.metadataLoaded().then(() => {
                        const sPath = "/costType(p_ZYEAR='" + sSelectedYear + "',p_ZWEEK='" + sWeekSelect + "')/Set"
                        oDataModel.read(sPath, {
                            success: (oData) => {
                                const oJsonModel = new JSONModel(oData);
                                this.oVizFrame.setModel(oJsonModel, 'viewModel');
                            },
                            error: (oError) => {
                                debugger
                            }
                        });
                    })

                })

            },

            onWeekChanged: function (oEvent) {
                const sWeekSelect = oEvent.getSource().getSelectedKey();
                const sSelectedYear = this.byId("idYearSelect").getSelectedKey();
                const oDataModel = this.getOwnerComponent().getModel();
                oDataModel.metadataLoaded().then(() => {
                    const sPath = "/costType(p_ZYEAR='" + sSelectedYear + "',p_ZWEEK='" + sWeekSelect + "')/Set"
                    oDataModel.read(sPath, {
                        success: (oData) => {
                            const oJsonModel = new JSONModel(oData);
                            this.oVizFrame.setModel(oJsonModel, 'viewModel');
                        },
                        error: (oError) => {
                            debugger
                        }
                    });
                })
            },

            _drawChart: function (oData) {
                const oJsonModel = new JSONModel(oData);
                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

                const oVizFrame = new VizFrame({
                    'width': '100%',
                    'height': '280px',
                    'uiConfig': {
                        'applicationSet': 'fiori'
                    }
                });

                this.oVizFrame = oVizFrame;

                oVizFrame.setVizProperties({
                    interaction: {
                        noninteractiveMode: true  //禁止所有图形的交互操作
                    },
                    title: {
                        text: oResourceBundle.getText('titleofchart')
                    }
                })

                // 设置图表属性
                oVizFrame.setModel(oJsonModel, 'viewModel');
                oVizFrame.setVizProperties({
                    interaction: {
                        noninteractiveMode: true  // 禁止所有图形的交互操作
                    },
                    plotArea: {
                        colorPalette: ['#FF0000', '#007BFF', '#87ceeb', '#61a656'],
                        drawingEffect: 'glossy',
                        dataLabel: {  //柱体字符
                            visible: true,
                            hideWhenOverlap: true,
                            style: {
                                fontSize: "8px", // 字体大小  
                            }
                        }
                    },
                    categoryAxis: {
                        label: {
                            style: {
                                fontSize: "8px", // 字体大小  
                            }
                        }
                    }
                });

                // 创建数据集
                const oDataset = new FlattenedDataset({
                    dimensions: [{
                        name: oResourceBundle.getText('costType'),
                        value: '{viewModel>ZCOSTTYPE}'
                    }],
                    measures: [{
                        name: oResourceBundle.getText('currentYear'),
                        value: '{viewModel>currentYearValue}'
                    }, {
                        name: oResourceBundle.getText('lastYear'),
                        value: '{viewModel>lastYearValue}'
                    }],
                    data: {
                        path: 'viewModel>/results'
                    }
                });

                // 绑定数据集和类型到图表
                oVizFrame.setDataset(oDataset);
                oVizFrame.setVizType('column');

                // 添加图表轴
                const feedvalueAxis = new FeedItem({
                    uid: "valueAxis",
                    type: "Measure",
                    values: [oResourceBundle.getText('currentYear'),
                    oResourceBundle.getText('lastYear')]
                });
                const feedcategoryAxis = new FeedItem({
                    uid: "categoryAxis",
                    type: "Dimension",
                    values: [oResourceBundle.getText('costType')]
                });
                oVizFrame.removeAllFeeds(); // 清除之前的feed项
                oVizFrame.addFeed(feedvalueAxis);
                oVizFrame.addFeed(feedcategoryAxis);

                const oGridChart = this.byId("idGridChart");
                oGridChart.addContent(oVizFrame);
            },

        });
    });
