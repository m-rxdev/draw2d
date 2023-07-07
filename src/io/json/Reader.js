import draw2d from '../../packages'

/**
 * @class
 *
 * Read a JSON data and import them into the canvas. The JSON must be generated with the
 * {@link draw2d.io.json.Writer}.
 *
 * @example
 *
 *     // Load a standard draw2d JSON object into the canvas
 *     //
 *     let jsonDocument =
 *         [
 *          {
 *             "type": "draw2d.shape.basic.Oval",
 *             "id": "5b4c74 b0-96d1-1aa3-7eca-bbeaed5fffd7",
 *             "x": 237,
 *             "y": 236,
 *             "width": 93,
 *             "height": 38
 *           },
 *           {
 *             "type": "draw2d.shape.basic.Rectangle",
 *             "id": "354fa3b9-a834-0221-2009-abc2d6bd852a",
 *             "x": 225,
 *             "y": 97,
 *             "width": 201,
 *             "height": 82,
 *             "radius": 2
 *           }
 *         ];
 *     // unmarshal the JSON document into the canvas
 *     // (load)
 *     let reader = new draw2d.io.json.Reader();
 *     reader.unmarshal(canvas, jsonDocument);
 *
 *
 * @author Andreas Herz
 * @extends draw2d.io.Reader
 */
draw2d.io.json.Reader = draw2d.io.Reader.extend(
  /** @lends draw2d.io.json.Reader.prototype */
  {
    NAME: "draw2d.io.json.Reader",
    figureConstructors: new Map(),

    init: function () {
      this._super();
    },

    /**
     *
     *
     * Restore the canvas from a given JSON object.
     *
     * @param {draw2d.Canvas} canvas the canvas to restore
     * @param {Object|String} json the json object to load.
     */
    unmarshal: function (canvas, json) {
      let result = new draw2d.util.ArrayList();      
      let startTime = performance.now();
      let endTime = performance.now();
      let createtime = 0;
      let addtime = 0;
      let looptime = 0;

      if (typeof json === "string") {
        json = JSON.parse(json);
      }

      startTime = performance.now();
      let node = null;
      json.forEach((element) => {
        try {
          let cs = performance.now();
          let o = this.createFigureFromElement(element) || this.createFigureFromType(element.type);
          o.repaintBlocked = true;
          // o.eventBlocked = true;
          let ce = performance.now();
          createtime += ce - cs;
          let source = null;
          let target = null;
          for (let i in element) {
            let val = element[i];
            if (i === "source") {
              node = canvas.getFigure(val.node);
              if (node === null) {
                throw "Source figure with id '" + val.node + "' not found";
              }
              source = node.getPort(val.port);
              if (source === null) {
                throw "Unable to find source port '" + val.port + "' at figure '" + val.node + "' to unmarschal '" + element.type + "'";
              }
            } else if (i === "target") {
              node = canvas.getFigure(val.node);
              if (node === null) {
                throw "Target figure with id '" + val.node + "' not found";
              }
              target = node.getPort(val.port);
              if (target === null) {
                throw "Unable to find target port '" + val.port + "' at figure '" + val.node + "' to unmarschal '" + element.type + "'";
              }
            }
          }
          if (source !== null && target !== null) {
            // don't change the order or the source/target set.
            // TARGET must always be the second one because some applications needs the "source"
            // port in the "connect" event of the target.
            o.setSource(source)
            o.setTarget(target)
          }
          let ls = performance.now();
          o.setPersistentAttributes(element)
          let le = performance.now();
          looptime += le - ls

          let as = performance.now();
          canvas.add(o)          
          let ae = performance.now();
          addtime += ae - as;
          result.add(o)
        } catch (exc) {
          debug.error(element, "Unable to instantiate figure type '" + element.type + "' with id '" + element.id + "' during unmarshal by " + this.NAME + ". Skipping figure..");
          debug.error(exc)
          debug.warn(element)
        }
      });
      endTime = performance.now();
      console.log(`DRAW2D - figures generated in ${endTime - startTime} milliseconds`);
      console.log(`DRAW2D - create figures in ${createtime} milliseconds`);
      console.log(`DRAW2D - loop figures in ${looptime} milliseconds`);
      console.log(`DRAW2D - add figures in ${addtime} milliseconds`);

      startTime = performance.now();
      result.data.forEach(figure => {
        figure.repaintBlocked = false;
        figure.eventBlocked = false;
        figure.repaint();
      });
      endTime = performance.now();
      console.log(`DRAW2D - repaint figures in ${endTime - startTime} milliseconds`);
      /*
      canvas.calculateConnectionIntersection();
      canvas.linesToRepaintAfterDragDrop.each((i, line) => {
        line.svgPathString = null
        line.repaint()
      })
      canvas.linesToRepaintAfterDragDrop = new draw2d.util.ArrayList();*/


      // restore group assignment
      //
      startTime = performance.now();
      json.forEach(element => {
        if (typeof element.composite !== "undefined") {
          let figure = canvas.getFigure(element.id);
          if (figure === null) {
            figure = canvas.getLine(element.id);
          }
          let group = canvas.getFigure(element.composite);
          group.assignFigure(figure);
        }
      });
      endTime = performance.now();
      console.log(`DRAW2D - restore group assignment in ${endTime - startTime} milliseconds`);

      // recalculate all crossings and repaint the connections with
      // possible crossing decoration
      startTime = performance.now();
      canvas.calculateConnectionIntersection();
      canvas.getLines().each((i, line) => {
        line.svgPathString = null;
        line.repaint();
      });
      canvas.linesToRepaintAfterDragDrop = canvas.getLines().clone();
      endTime = performance.now();
      console.log(`DRAW2D - calculateConnectionIntersection in ${endTime - startTime} milliseconds`);

      canvas.showDecoration();

      return result;
    },

    /**
     *
     * Factory method to create an instance of the given element type.
     *
     * @param {String} type
     * @returns {draw2d.Figure}
     */
    createFigureFromType: function (type) {
      if(!this.figureConstructors.has(type))
        this.figureConstructors.set(type, Function(`return new ${type}()`));      
      return this.figureConstructors.get(type)();
    },

    /**
     *
     * Factory method to create an instance of the given element.
     *
     * @param {Object} element
     * @returns {draw2d.Figure}
     */
    createFigureFromElement: function createFigureFromElement(element) {
      return null;
    }
  });
