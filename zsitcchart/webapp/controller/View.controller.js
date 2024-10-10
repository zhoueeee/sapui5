sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/viz/ui5/controls/VizFrame",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/controls/common/feeds/FeedItem",
    "sap/viz/ui5/data/MeasureDefinition",
    "sap/viz/ui5/data/DimensionDefinition"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, Filter, FilterOperator, JSONModel, VizFrame, FlattenedDataset, FeedItem
        , MeasureDefinition, DimensionDefinition) {
        "use strict";

        return Controller.extend("zdemowithpar.controller.View", {
            oVizFrames: {},
            onInit: function () {
                this.loadData();
            },

            loadData: async function () {
                try {
                    let oModel = this.getOwnerComponent().getModel();
                    const oCESATModel = this.getOwnerComponent().getModel('ZSB_CESAT_001');
                    let oYearSelect = this.byId('idYearSelect');
                    let oWeekSelect = this.byId("idWeekSelect");

                    // 1. 绑定年数据并设置当前年份
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

                    // 确保年数据加载完毕
                    await new Promise((resolve, reject) => {
                        const oBinding = oYearSelect.getBinding("items");
                        if (oBinding) {
                            oBinding.attachDataReceived(function () {
                                resolve(); // 年数据加载完成
                            });
                        } else {
                            reject("Year binding failed");
                        }
                    });
                    // 设置默认选中的值
                    const sCurrentYear = new Date().getFullYear().toString();
                    var aSelectedYearKeys = [sCurrentYear, sCurrentYear - 1, sCurrentYear - 2];
                    var aSelectedYearKeysStr = aSelectedYearKeys.map(String);
                    oYearSelect.setSelectedKeys(aSelectedYearKeysStr);

                    // 2. 绑定周数据并过滤当前年份
                    oWeekSelect.setModel(oModel);
                    const oFilter = new sap.ui.model.Filter("Zyear", sap.ui.model.FilterOperator.EQ, sCurrentYear);
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

                    // 确保周数据根据年份过滤后加载完毕
                    await new Promise((resolve, reject) => {
                        const oBinding = oWeekSelect.getBinding("items");
                        if (oBinding) {
                            oBinding.filter([oFilter]); // 过滤当前年份
                            oBinding.attachDataReceived(() => {
                                resolve(); // 周数据加载完成
                            });
                        } else {
                            reject("Week binding failed");
                        }
                    });

                    // 3. 获取当前周并设置
                    let sCurrentWeek = '00';
                    await new Promise((resolve, reject) => {
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

                            oModel.read("/yearweek", {
                                filters: aFilters,
                                success: (oData) => {
                                    if (oData.results && oData.results.length > 0) {
                                        sCurrentWeek = oData.results[0].Zweek;
                                        oWeekSelect.setSelectedKey(sCurrentWeek);
                                    }
                                    resolve();
                                },
                                error: (oError) => {
                                    reject(oError);
                                }
                            });
                        });
                    });

                    // 4. 使用 CESAT 模型加载图表数据
                    oCESATModel.metadataLoaded().then(() => {
                        const sPath = "/CESAT(p_ZWEEK='" + sCurrentWeek + "')/Set";
                        let aYearFilters = aSelectedYearKeysStr.map(function (year) {
                            return new sap.ui.model.Filter("Zyear", sap.ui.model.FilterOperator.EQ, year);
                        });
                        // 创建组合 Filter，使用 AND: false（即 OR）
                        let oYearCombinedFilter = new sap.ui.model.Filter({
                            filters: aYearFilters,
                            and: false
                        });
                        oCESATModel.read(sPath, {
                            filters: [oYearCombinedFilter],
                            success: (oData) => {
                                this._drawChart(this._transformData(oData.results, aSelectedYearKeysStr, 'ddtext'), aSelectedYearKeysStr, 'idVizframeCESAT'); // 绘制图表
                            },
                            error: (oError) => {
                            }
                        });
                    });

                    //累计支出按币别分析表 
                    this.getOwnerComponent().getModel('ZSB_CEBCA_001').metadataLoaded().then(() => {
                        const sPath = "/yearcurrrate(p_ZWEEK='" + sCurrentWeek + "')/Set";
                        //let topYears = aSelectedYearKeysStr.map(Number).sort((a, b) => b - a).slice(0, 2);
                        let aYearFilters = aSelectedYearKeysStr.map(function (year) {
                            return new sap.ui.model.Filter("Zyear", sap.ui.model.FilterOperator.EQ, year);
                        });
                        // 创建组合 Filter，使用 AND: false（即 OR）
                        var oYearCombinedFilter = new sap.ui.model.Filter({
                            filters: aYearFilters,
                            and: false
                        });
                        this.getOwnerComponent().getModel('ZSB_CEBCA_001').read(sPath, {
                            filters: [oYearCombinedFilter],
                            success: (oData) => {
                                this._drawCEBCAChart(this._transformCEBCAData(oData.results, aSelectedYearKeysStr), aSelectedYearKeysStr, 'idVizframeCEBCA');
                            },
                            error: (oError) => {
                            }
                        });
                    });

                    //累计支出按成本类型分析表CETCA
                    this.getOwnerComponent().getModel('ZSB_CETCA_001').metadataLoaded().then(() => {
                        const sPath = "/costType(p_ZWEEK='" + sCurrentWeek + "')/Set";
                        let aYearFilters = aSelectedYearKeysStr.map(function (year) {
                            return new sap.ui.model.Filter("Zyear", sap.ui.model.FilterOperator.EQ, year.toString());
                        });
                        // 创建组合 Filter，使用 AND: false（即 OR）
                        var oYearCombinedFilter = new sap.ui.model.Filter({
                            filters: aYearFilters,
                            and: false
                        });
                        this.getOwnerComponent().getModel('ZSB_CETCA_001').read(sPath, {
                            filters: [oYearCombinedFilter],
                            success: (oData) => {
                                this._drawCETCAChart(this._transformData(oData.results, aSelectedYearKeysStr, 'zcost_type'), aSelectedYearKeysStr, 'idVizframeCETCA');
                            },
                            error: (oError) => {
                            }
                        });
                    }
                    );
                } catch (oError) {

                }

            },

            _transformData: function (odataResult, years, keyField) {
                const resultMap = {};
                const maxYear = Math.max(...years.map(Number)); //20240929
                odataResult.forEach(item => {
                    const { Zyear, usdamount } = item;
                    const dynamicKey = item[keyField];

                    if (!resultMap[dynamicKey]) {
                        resultMap[dynamicKey] = { [keyField]: dynamicKey };

                        years.forEach(year => {
                            resultMap[dynamicKey][year] = "0.00";
                        });
                    }
                    const amountDivided = (parseFloat(usdamount) / 10000).toFixed(0);
                    resultMap[dynamicKey][Zyear] = amountDivided;
                });

                const transformedResult = Object.values(resultMap);
                transformedResult.sort((a, b) => Number(b[maxYear]) - Number(a[maxYear]));//20240929
                return {
                    result: transformedResult
                };
            },

            onYearChangeFinish: function (oEvent) {
                const sSelectedYearKeys = oEvent.getSource().getSelectedKeys();
                const maxYear = Math.max(...sSelectedYearKeys.map(Number));
                const oWeekSelect = this.byId("idWeekSelect")
                const oFilter = new Filter("Zyear", FilterOperator.EQ, maxYear);
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

                    const oDataModel = this.getOwnerComponent().getModel('ZSB_CESAT_001');
                    this._fetchAndDrawCESATData(oDataModel, sWeekSelect, sSelectedYearKeys, 'idVizframeCESAT');
                    //累计支出按币别分析表
                    this._fetchAndDrawCEBCAData(sWeekSelect, sSelectedYearKeys, 'idVizframeCEBCA');
                })

            },

            _fetchAndDrawCEBCAData(sCurrentWeek, aSelectedYearKeysStr, idVizframe) {
                const oModel = this.getOwnerComponent().getModel('ZSB_CESAT_001');
                oModel.metadataLoaded().then(() => {
                    const sPath = "/yearcurrrate(p_ZWEEK='" + sCurrentWeek + "')/Set";
                    const aYearFilters = aSelectedYearKeysStr.map(year => new sap.ui.model.Filter("Zyear", sap.ui.model.FilterOperator.EQ, year));
                    const oYearCombinedFilter = new sap.ui.model.Filter({ filters: aYearFilters, and: false });

                    oCESATModel.read(sPath, {
                        filters: [oYearCombinedFilter],
                        success: (oData) => {
                            this._drawCEBCAChart(this._transformCEBCAData(oData.results, aSelectedYearKeysStr), aSelectedYearKeysStr, idVizframe);
                            resolve();
                        },
                        error: (oError) => {
                            reject(oError);
                        }
                    });
                });
            },

            _drawCEBCAChart(oData, ayears, idVizframe) {
                const FIORI_PERCENTAGE_FORMAT_2 = "__UI5__PercentageMaxFraction2";
                const chartFormatter = sap.viz.ui5.format.ChartFormatter.getInstance();
                // 注册自定义格式器，百分比格式
                chartFormatter.registerCustomFormatter(FIORI_PERCENTAGE_FORMAT_2, function (value) {
                    var percentage = sap.ui.core.format.NumberFormat.getPercentInstance({
                        style: 'precent',
                        maxFractionDigits: 2
                    });
                    return percentage.format(value);
                });
                //必需要的不然轴的标签会不显示
                sap.viz.api.env.Format.numericFormatter(chartFormatter);

                const oJsonModel = new JSONModel(oData);
                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                let oVizFrame = this.oVizFrames[idVizframe];

                if (!oVizFrame) {
                    oVizFrame = new VizFrame(idVizframe, {
                        'width': '100%',
                        'height': '280px',
                        'uiConfig': {
                            'applicationSet': 'fiori'
                        }
                    });
                    const oGridChart = this.byId("idGridChart");
                    oGridChart.addContent(oVizFrame);
                    this.oVizFrames[idVizframe] = oVizFrame;

                    oVizFrame.attachBrowserEvent("click", function (oEvent) {
                        const sSelectYear = this.byId('idYearSelect').getSelectedKeys().join('');
                        const sSelectWeek = this.byId('idWeekSelect').getSelectedKey()
                        this.getOwnerComponent().getRouter().navTo('vizframeCEBCA', { years: sSelectYear, week: sSelectWeek }, false);
                    }.bind(this))
                }

                oVizFrame.setVizProperties({
                    interaction: {
                        noninteractiveMode: true,
                        syncValueAxis: false
                    },
                    scales: {
                        valueAxis: {
                            max: 100,
                            min: 0
                        }
                    },
                    plotArea: {
                        primaryValuesColorPalette: ['#FF0000', '#007BFF', '#87ceeb', '#61a656'],
                        secondaryValuesColorPalette: ['#FF0000', '#007BFF', '#87ceeb', '#61a656'],
                        drawingEffect: 'glossy',
                        dataLabel: {
                            visible: true,
                            hideWhenOverlap: true,
                            renderer: function (oEvent) {
                                if (oEvent.ctx.measureNames.includes(oResourceBundle.getText('proportion'))) {
                                    oEvent.text = (oEvent.val * 100).toFixed(2) + '%';
                                } else {
                                    //debugger
                                    oEvent.text = oEvent.val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                                }
                            },
                            style: {
                                fontSize: "8px", // 字体大小  
                            }
                        },
                        dataShape: {
                            primaryAxis: ayears.map(year => 'bar'),
                            secondaryAxis: ayears.map(year => 'line')
                        },
                        //自动会让双YY轴自动对齐，所以不要人为设置第二轴
                        /* secondaryScale:{
                            minValue:0,
                            maxValue:1,
                            fixedRange: true
                        },  */
                        window: {
                            //start: 'firstDataPoint',
                            //end: 'lastDataPoint'
                        }
                    },
                    title: {
                        text: oResourceBundle.getText('titleofCEBCAchart')
                    },
                    valueAxis: {
                        label: {
                            formatString: '###,##0' //20240929 
                        },
                        title: {
                            visible: false
                        },
                        axisLine: { visible: true },
                        axisTick: { visible: true },
                        visible: true
                    },
                    valueAxis2: {
                        label: {
                            formatString: FIORI_PERCENTAGE_FORMAT_2
                        },
                        title: {
                            visible: false
                        },
                        axisLine: { visible: true },
                        axisTick: { visible: true },
                        visible: true
                    }
                });

                oVizFrame.setModel(oJsonModel, 'viewModel');

                const aMeasuresYear = ayears.map(year => new MeasureDefinition({
                    name: year,
                    value: `{viewModel>${year}}`
                }));

                const aMeasuresProp = ayears.map(year => new MeasureDefinition({
                    name: `${year}${oResourceBundle.getText('proportion')}`,
                    value: `{viewModel>${year}prop}`,
                    unit: '%'
                }));

                const oDataset = new FlattenedDataset({
                    dimensions: [new DimensionDefinition({
                        name: oResourceBundle.getText('currency'),
                        value: '{viewModel>waers}'
                    })],
                    measures: aMeasuresYear.concat(aMeasuresProp),
                    data: {
                        path: 'viewModel>/result'
                    }
                });

                const feedValueAxis = new sap.viz.ui5.controls.common.feeds.FeedItem({
                    uid: "valueAxis",
                    type: "Measure",
                    values: ayears.map(year => year.toString())

                }), feedValueAxis2 = new sap.viz.ui5.controls.common.feeds.FeedItem({
                    uid: "valueAxis2",
                    type: "Measure",
                    values: ayears.map(year => `${year}${oResourceBundle.getText('proportion')}`)
                }),
                    categoryAxis = new sap.viz.ui5.controls.common.feeds.FeedItem({
                        uid: "categoryAxis",
                        type: "Dimension",
                        values: [oResourceBundle.getText('currency')]
                    });

                oVizFrame.destroyDataset();
                oVizFrame.setDataset(oDataset);
                oVizFrame.setVizType('info/dual_combination');

                oVizFrame.addFeed(feedValueAxis);
                oVizFrame.addFeed(feedValueAxis2);
                oVizFrame.addFeed(categoryAxis);

            },

            _transformCEBCAData(odataResult, years) {
                const result = [];
                const map = new Map();
                const maxYear = Math.max(...years.map(Number)); //20240929
                odataResult.forEach((item) => {
                    const key = item.waers;
                    if (!map.has(key)) {
                        let newObj = {
                            waers: item.waers
                        };
                        years.forEach(year => {
                            newObj[year] = 0.00;
                            newObj[`${year}prop`] = 0.0000
                        });
                        map.set(key, newObj);
                    }
                    const amountDivided = (parseFloat(item.usdamount) / 10000).toFixed(0); //20240929
                    map.get(key)[item.Zyear] = amountDivided;
                    map.get(key)[`${item.Zyear}prop`] = Number(item.currprop).toFixed(4);
                });

                result.push(...map.values());
                result.sort((a, b) => Number(b[maxYear]) - Number(a[maxYear]));//20240929
                return {
                    result: result.slice(0, 4)
                };
            },

            _fetchAndDrawCESATData: function (oCESATModel, sCurrentWeek, aSelectedYearKeysStr, idVizframe) {
                return new Promise((resolve, reject) => {
                    // 异步操作逻辑
                    oCESATModel.metadataLoaded().then(() => {
                        const sPath = "/CESAT(p_ZWEEK='" + sCurrentWeek + "')/Set";
                        const aYearFilters = aSelectedYearKeysStr.map(year => new sap.ui.model.Filter("Zyear", sap.ui.model.FilterOperator.EQ, year));
                        const oYearCombinedFilter = new sap.ui.model.Filter({ filters: aYearFilters, and: false });

                        oCESATModel.read(sPath, {
                            filters: [oYearCombinedFilter],
                            success: (oData) => {
                                this._drawChart(this._transformData(oData.results, aSelectedYearKeysStr), aSelectedYearKeysStr, idVizframe);
                                resolve();
                            },
                            error: (oError) => {
                                reject(oError);
                            }
                        });
                    });
                });
            },

            onWeekChanged: function (oEvent) {
                const sWeekSelect = oEvent.getSource().getSelectedKey();
                const sSelectedYearKeys = this.byId('idYearSelect').getSelectedKeys();
                const oDataModel = this.getOwnerComponent().getModel('ZSB_CESAT_001');
                this._fetchAndDrawCESATData(oDataModel, sWeekSelect, sSelectedYearKeys, 'idVizframeCESAT');
            },

            _drawChart: function (oData, ayears, idVizframe) {
                const oJsonModel = new JSONModel(oData);
                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                let oVizFrame = this.oVizFrames[idVizframe];
                if (!oVizFrame) {
                    oVizFrame = new VizFrame(idVizframe, {
                        'width': '100%',
                        'height': '280px',
                        'uiConfig': {
                            'applicationSet': 'fiori'
                        }
                    });
                    const oGridChart = this.byId("idGridChart");
                    oGridChart.addContent(oVizFrame);
                    this.oVizFrames[idVizframe] = oVizFrame;

                    oVizFrame.attachBrowserEvent("click", function (oEvent) {
                        const sSelectYear = this.byId('idYearSelect').getSelectedKeys().join('');
                        const sSelectWeek = this.byId('idWeekSelect').getSelectedKey()
                        this.getOwnerComponent().getRouter().navTo('vizframeCESAT', { years: sSelectYear, week: sSelectWeek }, false);
                    }.bind(this))
                }

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
                            hideWhenOverlap: false,
                            style: {
                                fontSize: "8px", // 字体大小  
                            },
                            formatString: [['###,##0']]  //千分位逗号 //20240929
                        }
                    },
                    categoryAxis: {
                        label: {
                            style: {
                                fontSize: "8px", // 字体大小  
                            }
                        }
                    },
                    valueAxis: {
                        label: {
                            formatString: '###,##0' //20240929
                        }
                    }
                });

                // 调用创建数据集的函数
                const oDataset = this._createDataset(oResourceBundle, 'viewModel', ayears);

                // 调用创建 feedItems 的函数
                const aFeeds = this._createFeedItems(oResourceBundle, ayears);

                // 绑定数据集和类型到图表
                oVizFrame.destroyDataset();
                oVizFrame.setDataset(oDataset);
                oVizFrame.setVizType('column');
                var axis = new sap.viz.ui5.types.Axis().setScale(new sap.viz.ui5.types.Axis_scale().setMinValue(0).setMaxValue(1).setFixedRange(true));
                // 清除之前的 feeds 并添加新的 feeds
                oVizFrame.removeAllFeeds();
                aFeeds.forEach(function (feedItem) {
                    oVizFrame.addFeed(feedItem);
                });

            },
            _createDataset: function (oResourceBundle, modelName, aYears) {
                const aMeasures = aYears.map(year => new MeasureDefinition({
                    name: year,
                    value: `{${modelName}>${year}}`
                }));
                return new FlattenedDataset({
                    dimensions: [new DimensionDefinition({
                        name: oResourceBundle.getText('Org'),
                        value: `{${modelName}>ddtext}`
                    })],
                    measures: aMeasures,
                    data: {
                        path: `${modelName}>/result`
                    }
                });
            },

            _createFeedItems: function (oResourceBundle, aYears) {
                const sortedYears = aYears.sort((a, b) => Number(b) - Number(a));
                const feedValueAxis = new FeedItem({
                    uid: "valueAxis",
                    type: "Measure",
                    values: sortedYears
                });

                const feedCategoryAxis = new FeedItem({
                    uid: "categoryAxis",
                    type: "Dimension",
                    values: [oResourceBundle.getText('Org')]
                });

                return [feedValueAxis, feedCategoryAxis];
            },

            _drawCETCAChart(oData, ayears, idVizframe) {
                const oJsonModel = new JSONModel(oData);
                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                let oVizFrame = this.oVizFrames[idVizframe];
                if (!oVizFrame) {
                    oVizFrame = new VizFrame(idVizframe, {
                        'width': '100%',
                        'height': '280px',
                        'uiConfig': {
                            'applicationSet': 'fiori'
                        }
                    });
                    const oGridChart = this.byId("idGridChart");
                    oGridChart.addContent(oVizFrame);
                    this.oVizFrames[idVizframe] = oVizFrame;

                    oVizFrame.attachBrowserEvent("click", function (oEvent) {
                        const sSelectYear = this.byId('idYearSelect').getSelectedKeys().join('');
                        const sSelectWeek = this.byId('idWeekSelect').getSelectedKey()
                        this.getOwnerComponent().getRouter().navTo('vizframeCETCA', { years: sSelectYear, week: sSelectWeek }, false);
                    }.bind(this))
                }

                oVizFrame.setVizProperties({
                    interaction: {
                        noninteractiveMode: true  //禁止所有图形的交互操作
                    },
                    title: {
                        text: oResourceBundle.getText('titleofCETCAchart')
                    }
                })

                // 设置图表属性
                oVizFrame.setModel(oJsonModel, 'viewModelCETCA');
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
                            },
                            formatString: [['###,##0']]  //千分位逗号 //20240929
                        }
                    },
                    categoryAxis: {
                        label: {
                            style: {
                                fontSize: "8px", // 字体大小  
                            }
                        }
                    },
                    valueAxis: {
                        label: {
                            formatString: '###,##0' //20240929
                        }
                    }
                });

                // 调用创建数据集的函数
                const oDataset = this._createDatasetCETCA(oResourceBundle, 'viewModelCETCA', ayears);

                // 调用创建 feedItems 的函数
                const aFeeds = this._createFeedItemsCETCA(oResourceBundle, ayears);

                // 绑定数据集和类型到图表
                oVizFrame.destroyDataset();
                oVizFrame.setDataset(oDataset);
                oVizFrame.setVizType('column');
                var axis = new sap.viz.ui5.types.Axis().setScale(new sap.viz.ui5.types.Axis_scale().setMinValue(0).setMaxValue(1).setFixedRange(true));
                // 清除之前的 feeds 并添加新的 feeds
                oVizFrame.removeAllFeeds();
                aFeeds.forEach(function (feedItem) {
                    oVizFrame.addFeed(feedItem);
                });
            },

            _createDatasetCETCA: function (oResourceBundle, modelName, aYears) {
                const aMeasures = aYears.map(year => new MeasureDefinition({
                    name: year,
                    value: `{${modelName}>${year}}`
                }));
                return new FlattenedDataset({
                    dimensions: [new DimensionDefinition({
                        name: oResourceBundle.getText('costType'),
                        value: `{${modelName}>zcost_type}`
                    })],
                    measures: aMeasures,
                    data: {
                        path: `${modelName}>/result`
                    }
                });
            },

            _createFeedItemsCETCA: function (oResourceBundle, aYears) {
                const sortedYears = aYears.sort((a, b) => Number(b) - Number(a));
                const feedValueAxis = new FeedItem({
                    uid: "valueAxis",
                    type: "Measure",
                    values: sortedYears
                });

                const feedCategoryAxis = new FeedItem({
                    uid: "categoryAxis",
                    type: "Dimension",
                    values: [oResourceBundle.getText('costType')]
                });

                return [feedValueAxis, feedCategoryAxis];
            },

            onExit: function () {
                for (const [key, vizFrame] of Object.entries(this.oVizFrames)) {
                    if (vizFrame && typeof vizFrame.destroy === 'function') {
                        // 销毁 VizFrame 控件
                        vizFrame.destroy();
                    }
                }
                Object.keys(this.oVizFrames).forEach(key => delete this.oVizFrames[key]);
            }

        });
    });
