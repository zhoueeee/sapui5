sap.ui.define([
    "sap/ui/core/mvc/Controller"
],
    function (Controller) {
        "use strict";

        return Controller.extend("zprojectv4.controller.View", {
            onInit: function () {
                // 定义图表 ID 和对应的 rect 类名的映射
                var aVizFrameMappings = [
                    { id: 'idVizFrameLeftDown', rectClass: 'rect.v-plot-bound.v-bound.v-zoom-plot', routerName: 'vizFrameLeftUpDetail' },
                    { id: 'idVizFrameLeftUp', rectClass: 'rect.v-plot-bound.v-bound.v-zoom-plot', routerName: 'vizFrameLeftUpDetail' },
                    { id: 'idVizFrameRightDown', rectClass: 'rect.v-bound', routerName: 'vizFrameLeftUpDetail' },
                    { id: 'idVizFrameRightUp', rectClass: 'rect.v-plot-bound.v-bound.v-zoom-plot', routerName: 'vizFrameLeftUpDetail' }
                ];

                // 遍历每个 VizFrame 并添加相应的事件监听器
                aVizFrameMappings.forEach(function (map) {
                    this.getView().byId(map.id).attachBrowserEvent("click", function (event) {
                        //let $target = jQuery(event.target);
                        //if ($target.is(map.rectClass)) {
                        //    debugger;
                        this.getOwnerComponent().getRouter().navTo(map.routerName);
                        //}
                    }.bind(this));
                    var oVizFrame = this.getView().byId(map.id);
                    oVizFrame.setVizProperties({
                        interaction: {
                            noninteractiveMode: true  //禁止所有图形的交互操作
                        }
                    })
                }.bind(this));



            }
        });
    });
