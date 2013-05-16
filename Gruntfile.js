/*global module:false*/
module.exports = function(grunt) {

  var cfg = {};

  // Project configuration.
  grunt.initConfig({
    pkg: '<json:package.json>',
    meta: {
      banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        '<%= pkg.homepage ? "* " + pkg.homepage + "\n" : "" %>' +
        '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */'
    },
    jsduck: {
      main: {
        // source paths with your code
        src: [
          './lib'
        ],

        // docs output dir
        dest: '../node-daemon-docs/manual',

        // extra options
        options: {
          'title': 'node-windows',
          //'welcome': 'src/assets/html/welcome.html',
          'head-html': '<link rel="stylesheet" href="resources/css/main.css" type="text/css">',
          //'categories': 'src/categories.json',
          'guides': 'docs/guides.json',
          'color': true,
          'builtin-classes': true,
          'warnings': ['-req_after_opt'],
          'external': ['XMLHttpRequest']
        }
      }
    },
    clean: {
      docs: ["../node-daemon-docs/manual"],
    },
    copy: {
      jsduckassets: {
        files: [
          {expand: true, cwd: './docs/assets/css/', src:['*.*'], dest: '../node-daemon-docs/manual/resources/css/'},
          {expand: true, cwd: './docs/assets/images/', src:['*.*'], dest: '../node-daemon-docs/manual/resources/images/'},
          {expand: true, cwd: './docs/assets/images/', src:['tabs.png'], dest: '../node-daemon-docs/manual/resources/images/'}
        ]
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-jsduck');
  grunt.loadNpmTasks('grunt-contrib-clean');

  // Default task.
  grunt.registerTask('default', ['clean:docs','jsduck','copy:jsduckassets']);
};