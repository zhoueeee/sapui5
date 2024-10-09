sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Item",
    "sap/ui/model/json/JSONModel",
    "sap/viz/ui5/controls/VizFrame",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/controls/common/feeds/FeedItem",
    "sap/viz/ui5/data/MeasureDefinition",
    "sap/viz/ui5/data/DimensionDefinition",
    "sap/viz/ui5/controls/VizSlider",
    "sap/viz/ui5/controls/Popover"
  ],
  function (BaseController,
    History, Filter, FilterOperator, Item, JSONModel, VizFrame
    , FlattenedDataset, FeedItem, MeasureDefinition, DimensionDefinition,
    VizSlider, Popover
  ) {
    "use strict";

    return BaseController.extend("zdemowithpar.controller.CEBCA.vizFrameCEBCAOrgView.", {
      onInit() {
        this.getOwnerComponent().getRouter().getRoute("vizframeCEBCAOrg").attachMatched(this._onRouteMatched, this);
      },

      _onRouteMatched(oEvent) {
        this.loadData(oEvent);
      },

      loadData: async function (oEvent) {
        try {
          const oCESATModel = this.getOwnerComponent().getModel('ZSD_CESAT_001');
          const oCEBCAModel = this.getOwnerComponent().getModel('ZSD_CEBCA_001');
          let oYearSelect = this.byId('idYearSelectCEBCAOrg');
          let oWeekSelect = this.byId('idWeekSelectCEBCAOrg');

          // 1. 绑定年数据 
          oYearSelect.setModel(oCESATModel);
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
          const oArgs = oEvent.getParameter("arguments");
          const sSelectYears = oArgs.years;
          const sSelectWeek = oArgs.week;

          var aSelectedYearKeys = sSelectYears.match(/.{1,4}/g);
          aSelectedYearKeys = aSelectedYearKeys.map(Number).sort((a, b) => b - a).slice(0, 2);
          oYearSelect.setSelectedKeys(aSelectedYearKeys);

          // 2. 绑定周数据并过滤当前年份
          oWeekSelect.setModel(oCESATModel);
          const oFilter = new Filter("Zyear", FilterOperator.EQ, aSelectedYearKeys[0]);
          oWeekSelect.bindItems({
            path: '/yearweek',
            sorter: {
              path: 'Zweek',
              descending: false
            },
            template: new Item({
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

          // 3. 设置周的默认值
          oWeekSelect.setSelectedKey(sSelectWeek);

          //设置体系的默认值
          const oOrgSelect = this.byId('idOrgSelectListCEBCA');
          oOrgSelect.bindItems({
            path: 'ZSB_CESAT_001>/org',
            template: new sap.ui.core.ListItem({
              key: "{ZSB_CESAT_001>Value}",
              text: "{ZSB_CESAT_001>Ddtext}",
            })
          });
          await new Promise((resolve, reject) => {
            const oBinding = oOrgSelect.getBinding("items");
            if (oBinding) {
              oBinding.attachDataReceived(() => {
                resolve();
              });
            } else {
              reject("Org binding failed");
            }
          });
          oOrgSelect.setSelectedKey('T100');

          // 4. 使用 CEBCA 模型加载图表数据
          this.getOwnerComponent().getModel('ZSB_CEBCA_001').metadataLoaded().then(() => {
            const sPath = "/org(p_ZWEEK='" + sSelectWeek + "')/Set";
            var aYearFilters = aSelectedYearKeys.map(function (year) {
              return new Filter("Zyear", FilterOperator.EQ, year);
            });
            // 创建组合 Filter，使用 AND: false（即 OR）
            var oYearCombinedFilter = new Filter({
              filters: aYearFilters,
              and: false
            });

            // 创建 org = T100 的过滤器
            const oOrgFilter = new sap.ui.model.Filter("org", sap.ui.model.FilterOperator.EQ, "T100");

            //Zyear and Org
            var oFinalFilter = new sap.ui.model.Filter({
              filters: [oYearCombinedFilter, oOrgFilter],
              and: true // 使用 AND 逻辑
            });

            this.getOwnerComponent().getModel('ZSB_CEBCA_001').read(sPath, {
              filters: [oFinalFilter],
              success: (oData) => {
                this._drawCEBCAChart(this._transformCEBCAData(oData.results, aSelectedYearKeys), aSelectedYearKeys, 'idVizframeCEBCAOrg', 'T100'); // 绘制图表
              },
              error: (oError) => {
              }
            });
          });

        } catch (oError) {
          console.log(oError);
        }
      },

      _drawCEBCAChart(oData, ayears, idVizframe, sOrg) {
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
        let oVizFrame = this.byId('idVizframeCEBCAOrg');

        if (!oVizFrame) {
          oVizFrame = new VizFrame(idVizframe, {
            'width': '100%',
            'height': '280px',
            'uiConfig': {
              'applicationSet': 'fiori'
            }
          });
          //const oGridChart = this.byId("idGridChart");
          //oGridChart.addContent(oVizFrame);
          this.oVizFrame = oVizFrame;
        }

        //oVizFrame.attachBrowserEvent("click", function (oEvent) {
        //  const sSelectYear = this.byId('idYearSelectCEBCA').getSelectedKeys().join('');
        //  const sSelectWeek = this.byId('idWeekSelectCEBCA').getSelectedKey()
        //  this.getOwnerComponent().getRouter().navTo('vizframeCEBCAOrg', { years: sSelectYear, week: sSelectWeek }, false);
        //}.bind(this))
        const sOrgPath = "/org('" + sOrg + "')/Ddtext";
        const sDdtext = this.getOwnerComponent().getModel('ZSB_CESAT_001').getProperty(sOrgPath);
        const sTitleText = (sDdtext ? sDdtext + "-" : "") + oResourceBundle.getText('titleofCEBCAchart');

        oVizFrame.setVizProperties({
          interaction: {
            noninteractiveMode: false,
            syncValueAxis: false,
            selectability: {
              mode: 'SINGLE'
            }
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
            gap: {
              innerGroupSpacing: 0
            },
            dataLabel: {
              visible: true,
              hideWhenOverlap: false,
              renderer: function (oEvent) {
                if (oEvent.ctx.measureNames.includes(oResourceBundle.getText('proportion'))) {
                  oEvent.text = (oEvent.val * 100).toFixed(2) + '%';
                } else {
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
            text: sTitleText
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
          name: year.toString(),
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
        oVizFrame.getDataset().getBinding("data").filter(this._oLastestFilter);
        //oVizFrame.setVizType('info/dual_horizontal_combination');

        oVizFrame.removeAllFeeds();
        oVizFrame.addFeed(feedValueAxis);
        oVizFrame.addFeed(feedValueAxis2);
        oVizFrame.addFeed(categoryAxis);

        // Popover绑定
        var oPopOver = new Popover();
        oPopOver.connect(oVizFrame.getVizUid());

        const oVizSlider = this.byId('idVizSliderCEBCAOrg');
        oVizSlider.destroyDataset();
        const oJsonModelSlider = new JSONModel(oData);
        oVizSlider.setModel(oJsonModelSlider, 'viewModelSlider');
        const oDatasetSlider = new FlattenedDataset({
          dimensions: [new DimensionDefinition({
            name: oResourceBundle.getText('currency'),
            value: '{viewModelSlider>waers}'
          })],
          measures: ayears.map(year => new MeasureDefinition({
            name: year,
            value: `{viewModelSlider>${year}}`
          })),
          data: {
            path: 'viewModelSlider>/result'
          }
        });
        oVizSlider.setDataset(oDatasetSlider);
        oVizSlider.destroyFeeds();
        oVizSlider.removeAllFeeds();
        const feedValueAxisSlider = new sap.viz.ui5.controls.common.feeds.FeedItem({
          uid: "valueAxis",
          type: "Measure",
          values: ayears.map(year => year.toString())

        }),
          categoryAxisSlider = new sap.viz.ui5.controls.common.feeds.FeedItem({
            uid: "categoryAxis",
            type: "Dimension",
            values: [oResourceBundle.getText('currency')]
          });

        oVizSlider.addFeed(feedValueAxisSlider);
        oVizSlider.addFeed(categoryAxisSlider);

        oVizSlider.attachRangeChanged((oEvent) => {
          const filters = oEvent.getParameter('data').data.map(item => {
            return new sap.ui.model.Filter(
              "waers",
              sap.ui.model.FilterOperator.EQ,
              item[oResourceBundle.getText('currency')]
            );
          });
          const oBinding = oVizFrame.getDataset().getBinding("data");
          this._oLastestFilter = filters;
          oBinding.filter(filters);
        })
      },

      _transformCEBCAData(odataResult, years) {
        const result = []; debugger;
        const map = new Map();
        const maxYear = Math.max(...years.map(Number));
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
          const amountDivided = (parseFloat(item.usdamount) / 10000).toFixed(0);
          map.get(key)[item.Zyear] = amountDivided;
          map.get(key)[`${item.Zyear}prop`] = Number(item.currprop).toFixed(4);
        });

        result.push(...map.values());
        result.sort((a, b) => Number(b[maxYear]) - Number(a[maxYear]));//20240929
        return {
          result: result
        };
      },

      onYearChangeFinish: function (oEvent) {
        const sSelectedYearKeys = oEvent.getSource().getSelectedKeys();
        const maxYear = Math.max(...sSelectedYearKeys.map(Number));
        const oWeekSelect = this.byId("idWeekSelectCEBCAOrg")
        const oFilter = new Filter("Zyear", FilterOperator.EQ, maxYear);
        const oBinding = oWeekSelect.getBinding("items");
        oBinding.filter([oFilter]);

        let sWeekSelect = oWeekSelect.getSelectedKey();
        let sOrg = this.byId("idOrgSelectListCEBCA").getSelectedKey();
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

          const oDataModel = this.getOwnerComponent().getModel('ZSB_CEBCA_001');
          this._fetchAndDrawCEBCAData(oDataModel, sWeekSelect, sSelectedYearKeys, sOrg);
        })
      },

      _fetchAndDrawCEBCAData: function (oCESATModel, sCurrentWeek, aSelectedYearKeysStr, sOrg) {
        return new Promise((resolve, reject) => {
          // 异步操作逻辑
          oCESATModel.metadataLoaded().then(() => {
            const sPath = "/org(p_ZWEEK='" + sCurrentWeek + "')/Set";
            const aYearFilters = aSelectedYearKeysStr.map(year => new sap.ui.model.Filter("Zyear", sap.ui.model.FilterOperator.EQ, year));

            const oYearCombinedFilter = new sap.ui.model.Filter({ filters: aYearFilters, and: false });

            // 创建Org的过滤器
            const oOrgFilter = new sap.ui.model.Filter("org", sap.ui.model.FilterOperator.EQ, sOrg);

            //Zyear and Org
            var oFinalFilter = new sap.ui.model.Filter({
              filters: [oYearCombinedFilter, oOrgFilter],
              and: true
            });

            oCESATModel.read(sPath, {
              filters: [oFinalFilter],
              success: (oData) => {
                this._drawCEBCAChart(this._transformCEBCAData(oData.results, aSelectedYearKeysStr), aSelectedYearKeysStr, 'idVizframeCEBCAOrg', sOrg);
                resolve();
              },
              error: (oError) => {
                this._drawCEBCAChart([], aSelectedYearKeysStr, 'idVizframeCEBCAOrg', sOrg);
                reject(oError);
              }
            });
          });
        });
      },

      onWeekChanged: function (oEvent) {
        const sWeekSelect = oEvent.getSource().getSelectedKey();
        const sSelectedYearKeys = this.byId('idYearSelectCEBCAOrg').getSelectedKeys();
        let sOrg = this.byId("idOrgSelectListCEBCA").getSelectedKey();
        const oDataModel = this.getOwnerComponent().getModel('ZSB_CEBCA_001');
        debugger
        this._fetchAndDrawCEBCAData(oDataModel, sWeekSelect, sSelectedYearKeys, sOrg);
      },

      onOrgChanged(oEvent) {
        const sOrg = oEvent.getSource().getSelectedKey();
        const sSelectedYearKeys = this.byId('idYearSelectCEBCAOrg').getSelectedKeys();
        let sWeekSelect = this.byId("idWeekSelectCEBCAOrg").getSelectedKey();
        const oDataModel = this.getOwnerComponent().getModel('ZSB_CEBCA_001');
        debugger
        this._fetchAndDrawCEBCAData(oDataModel, sWeekSelect, sSelectedYearKeys, sOrg);

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
